from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from codex_loop_ab import assert_config_unchanged  # noqa: E402


class ConfigNormalizationTests(unittest.TestCase):
    def test_autocrlf_checkout_matches_head_but_real_edits_fail(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            repo = Path(temp_dir)
            config = repo / "checks.json"
            config.write_bytes(b'{\n  "tasks": {"1": [{"argv": ["node", "--version"]}]}\n}\n')

            def git(*args: str) -> bytes:
                return subprocess.run(
                    ["git", *args], cwd=repo, check=True, capture_output=True,
                ).stdout

            git("init", "--quiet")
            git("config", "core.autocrlf", "true")
            git("config", "user.name", "Test")
            git("config", "user.email", "test@example.invalid")
            git("add", "checks.json")
            git("commit", "--quiet", "-m", "add checks")
            config.unlink()
            git("checkout", "--", "checks.json")

            expected = git("show", "HEAD:checks.json")
            self.assertNotEqual(config.read_bytes(), expected)
            self.assertIn(b"\r\n", config.read_bytes())

            assert_config_unchanged(repo, config)

            config.write_bytes(config.read_bytes().replace(b"node", b"bun"))
            with self.assertRaisesRegex(RuntimeError, "must be committed and unchanged"):
                assert_config_unchanged(repo, config)


if __name__ == "__main__":
    unittest.main()
