import { AUTH_PROVIDER } from '../constants/user.constants.js';
import { User } from '../models/user.model.js';
import type { RegisterUserInput } from '../schemas/user.schema.js';

export async function registerUser(data: RegisterUserInput) {
  const existingUser = await User.findOne({ email: data });

  if (existingUser) {
    if (existingUser.provider === AUTH_PROVIDER.GOOGLE) {
      throw new Error('Email already registered with Google. Please login with Google.');
    }

    throw new Error('Email already in use.');
  }

  const user = await User.create(data);

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  };
}
