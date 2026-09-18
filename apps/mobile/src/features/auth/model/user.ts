import type { UserDto } from '@opensell/shared';

export type User = Omit<UserDto, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

// Only user fields enter Redux; API dates become serializable timestamps.
export function toSessionUser(user: UserDto): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    ...(user.profileImage === undefined ? {} : { profileImage: user.profileImage }),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
