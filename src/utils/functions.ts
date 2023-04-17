import { CreateUsernameResponse, ParticipantPopulated } from "./types";
import { PrismaClient } from "@prisma/client";

export const userIsConversationParticipant = (
  participants: Array<ParticipantPopulated>,
  userId: string
): boolean => {
  return !!participants.find((participant) => participant.userId === userId);
};
export const verifyAndCreateUsername = async (
  args: { userId: string; username: string; avatar: string },
  prisma: PrismaClient
): Promise<CreateUsernameResponse> => {
  const { userId, username, avatar } = args;

  try {
    const existingUser = await prisma.user.findUnique({
      where: {
        username,
      },
    });

    if (existingUser) {
      return {
        error: "Username already taken. Try another",
      };
    }

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        username,
        avatar,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.log("createUsername error", error);
    return {
      error: error?.message as string,
    };
  }
};
