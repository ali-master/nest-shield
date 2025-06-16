import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { getActiveSessions, revokeSpecificSession, revokeUserSessions } from "@/lib/auth/security";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin and requesting sessions for another user
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");

    if (targetUserId && targetUserId !== session.user.id) {
      if (session.user.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const userId = targetUserId || session.user.id;
    const sessions = await getActiveSessions(userId);

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Get sessions error:", error);
    return NextResponse.json({ error: "Failed to get sessions" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, userId, revokeAll } = body;

    // Check permissions
    if (userId && userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetUserId = userId || session.user.id;

    if (revokeAll) {
      // Revoke all sessions for user (except current one)
      const revokedCount = await revokeUserSessions(targetUserId, session.user.id);
      return NextResponse.json({
        success: true,
        revokedCount,
        message: `Revoked ${revokedCount} sessions`,
      });
    } else if (sessionId) {
      // Revoke specific session
      const success = await revokeSpecificSession(sessionId);
      return NextResponse.json({
        success,
        message: success ? "Session revoked" : "Session not found",
      });
    } else {
      return NextResponse.json({ error: "Must specify sessionId or revokeAll" }, { status: 400 });
    }
  } catch (error) {
    console.error("Session revocation error:", error);
    return NextResponse.json({ error: "Failed to revoke sessions" }, { status: 500 });
  }
}
