import { AppError } from "@/lib/app-error";
import { getCurrentUser } from "@/lib/current-user";
import { hashPassword, verifyPassword } from "@/lib/password";
import { userRepository } from "@/modules/users/repositories/user-repository";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/modules/profile/validation/change-password-schema";

export const profileService = {
  // Self-service — always operates on the requesting user's own account,
  // derived server-side via getCurrentUser(), never a caller-supplied id.
  // No assertAdministrator() gate: every authenticated user (not just
  // Administrators) may change their own password.
  async changeOwnPassword(input: ChangePasswordInput): Promise<void> {
    const currentUser = await getCurrentUser();
    const data = changePasswordSchema.parse(input);

    const passwordHash = await userRepository.findPasswordHashById(currentUser.id);
    if (!passwordHash) {
      throw new AppError("User not found.");
    }

    const isCurrentPasswordValid = await verifyPassword(passwordHash, data.currentPassword);
    if (!isCurrentPasswordValid) {
      throw new AppError("Current password is incorrect.");
    }

    const newPasswordHash = await hashPassword(data.newPassword);
    await userRepository.updatePasswordHash(currentUser.id, newPasswordHash);
  },
};
