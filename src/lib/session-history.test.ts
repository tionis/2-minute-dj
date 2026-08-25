import { describe, expect, it } from "vitest";
import { escapeHtml, generateSessionHTML, type SessionSnapshot } from "./session-history";

describe("session exports", () => {
  it("escapes untrusted song and player metadata in downloaded HTML", () => {
    const session: SessionSnapshot = {
      id: "session", roomCode: "TEST", playerCount: 1, endedAt: 1, role: "host",
      songs: [{ id: "song", video_id: "dQw4w9WgXcQ", video_title: "<script>alert(1)</script>",
        player_nickname: "<img src=x onerror=alert(1)>", votes: [], status: "PLAYED" }],
    };
    const html = generateSessionHTML(session);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes all HTML-sensitive characters", () => {
    expect(escapeHtml(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&#39;");
  });
});
