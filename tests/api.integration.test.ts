import { isolatedTestDatabaseURL } from "./test-database.js";
import { processNotificationJobs } from "../apps/api/src/notifications.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { migrate } from "../packages/database/src/migrate.js";
import { createAuth } from "../apps/auth/src/auth.js";
import { createApp } from "../apps/api/src/app.js";
const databaseURL = isolatedTestDatabaseURL(process.env.TEST_DATABASE_URL);
test(
  "real PostgreSQL and Better Auth business authorization, chat and admin transactions",
  { skip: !databaseURL },
  async () => {
    const pool = new Pool({ connectionString: databaseURL });
    const mail: any[] = [];
    const auth = createAuth(
      {
        databaseURL: databaseURL!,
        secret: "integration-secret-at-least-thirty-two-characters",
        baseURL: "http://localhost:3001",
        trustedOrigins: ["http://localhost:3001"],
        domains: ["purdue.edu"],
        mail: { url: undefined, from: undefined },
      },
      pool,
      async (message) => {
        mail.push(message);
      },
    );
    const migrations = await getMigrations(auth.options);
    await migrations.runMigrations();
    await migrate(pool);
    await migrate(pool);
    const server = createServer(
      createApp({ pool, auth, origin: "http://localhost:3001" }),
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address() as any;
    const base = `http://127.0.0.1:${address.port}/api/v1`;
    const request = async (
      path: string,
      method = "GET",
      body?: any,
      cookie = "",
    ) => {
      const r = await fetch(base + path, {
        method,
        headers: { "content-type": "application/json", cookie },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: r.status, ...((await r.json()) as any) };
    };
    async function account() {
      const email = `api-${crypto.randomUUID()}@purdue.edu`;
      await auth.api.signUpEmail({
        body: { email, password: "Strong-password-12345", name: "Member" },
      });
      const text = mail.at(-1).text;
      const token = new URL(text).searchParams.get("token")!;
      await auth.api.verifyEmail({ query: { token } });
      const response = await auth.api.signInEmail({
        body: { email, password: "Strong-password-12345" },
        asResponse: true,
      });
      const cookie = response.headers
        .getSetCookie()
        .map((v) => v.split(";")[0])
        .join("; ");
      const user = (
        await pool.query('SELECT id FROM "user" WHERE email=$1', [email])
      ).rows[0];
      return { id: user.id, cookie };
    }
    try {
      const a = await account(),
        b = await account(),
        c = await account();
      const item = {
        title: "Desk",
        description: "A desk",
        category: "furniture",
        condition: "good",
        deliveryMethod: "pickup",
        priceCents: 100,
      };
      assert.equal((await request("/items", "POST", item)).status, 401);
      assert.equal(
        (
          await request(
            "/items",
            "POST",
            { ...item, priceCents: 1.5 },
            a.cookie,
          )
        ).status,
        400,
      );
      const created = await request("/items", "POST", item, a.cookie);
      assert.equal(created.status, 200);
      const id = created.data.id;
      assert.equal(
        (await request("/items/" + id, "PATCH", { title: "stolen" }, b.cookie))
          .status,
        403,
      );
      assert.equal((await request("/items/" + id)).data.title, "Desk");
      assert.equal(
        (
          await request(
            "/settings",
            "PATCH",
            { contactEnabled: false },
            a.cookie,
          )
        ).status,
        403,
      );
      const filterTitle = "Attribute-" + crypto.randomUUID();
      const fixture = async (publisher: string, data: any, status = "active") => {
        const result = await pool.query(
          "INSERT INTO entities(id,kind,publisher_id,data,status) VALUES(gen_random_uuid(),'item',$1,$2,$3) RETURNING id",
          [publisher, { ...item, title: filterTitle, ...data }, status],
        );
        return result.rows[0].id;
      };
      const matching = [];
      for (let i = 0; i < 52; i++)
        matching.push(await fixture(i % 2 ? b.id : c.id, { priceCents: i === 0 ? 0 : 1200 }));
      for (const data of [
        { priceCents: 1201 }, { condition: "fair" },
        { deliveryMethod: "delivery" }, { category: "electronics" },
      ]) await fixture(b.id, data);
      await fixture(b.id, {}, "deactivated");
      const query = new URLSearchParams({ q: filterTitle, category: "furniture", minPriceCents: "0", maxPriceCents: "1200", condition: "good", deliveryMethod: "pickup" });
      const filteredRows: any[] = [];
      let nextCursor: string | null = null;
      let pages = 0;
      do {
        if (nextCursor) query.set("cursor", nextCursor);
        const page = await request("/items?" + query);
        assert.equal(page.status, 200, JSON.stringify(page));
        assert.equal(page.data.length, pages === 0 ? 50 : 2);
        filteredRows.push(...page.data);
        nextCursor = page.nextCursor;
        assert.ok(++pages <= 2, "pagination must finish");
      } while (nextCursor);
      assert.equal(new Set(filteredRows.map((r) => r.id)).size, 52);
      assert.deepEqual(new Set(filteredRows.map((r) => r.id)), new Set(matching));
      assert.ok(filteredRows.every((r) => r.priceCents >= 0 && r.priceCents <= 1200 && r.condition === "good" && r.deliveryMethod === "pickup"));
      assert.equal(new Set(filteredRows.map((r) => r.publisherId)).size, 2);
      const expectedFiltered = (await pool.query("SELECT id FROM entities WHERE id=ANY($1::uuid[]) ORDER BY created_at DESC,id DESC", [matching])).rows.map((r) => r.id);
      assert.deepEqual(filteredRows.map((r) => r.id), expectedFiltered);
      const free = await request("/items?q=" + filterTitle + "&minPriceCents=0&maxPriceCents=0");
      assert.deepEqual(free.data.map((r: any) => r.id), [matching[0]]);
      for (const invalid of ["minPriceCents=-1", "maxPriceCents=1.1", "minPriceCents=2&maxPriceCents=1", "condition=broken", "deliveryMethod=ship"])
        assert.equal((await request("/items?" + invalid)).status, 400, invalid);
      assert.equal((await request("/rides?minPriceCents=-1&condition=broken")).status, 200);
      const first = await request(
        "/conversations",
        "POST",
        { otherUserId: b.id },
        a.cookie,
      );
      const second = await request(
        "/conversations",
        "POST",
        { otherUserId: a.id },
        b.cookie,
      );
      assert.equal(first.status, 200, JSON.stringify(first));
      assert.equal(second.status, 200, JSON.stringify(second));
      assert.equal(first.data.id, second.data.id);
      const conversation = first.data.id;
      assert.equal(
        (
          await request(
            `/conversations/${conversation}/messages`,
            "GET",
            undefined,
            c.cookie,
          )
        ).status,
        403,
      );
      const payload = {
        clientId: "same",
        text: "Hello",
        reference: { type: "item", id },
      };
      const m1 = await request(
        `/conversations/${conversation}/messages`,
        "POST",
        payload,
        a.cookie,
      );
      const m2 = await request(
        `/conversations/${conversation}/messages`,
        "POST",
        payload,
        a.cookie,
      );
      assert.equal(m1.data.id, m2.data.id);
      assert.equal(
        (
          await request(
            `/conversations/${conversation}/messages`,
            "POST",
            { ...payload, text: "Changed" },
            a.cookie,
          )
        ).status,
        409,
      );
      assert.equal((await request("/items/not-a-uuid")).status, 400);
      assert.equal(
        (
          await request(
            "/items",
            "POST",
            { ...item, communityId: "other" },
            a.cookie,
          )
        ).data.communityId,
        "purdue",
      );
      assert.equal(
        (await request("/conversations", "GET", undefined, b.cookie)).data[0]
          .unreadCount,
        1,
      );
      assert.equal(
        (
          await request(
            `/conversations/${conversation}/read`,
            "PUT",
            { messageId: m1.data.id },
            b.cookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (await request("/conversations", "GET", undefined, b.cookie)).data[0]
          .unreadCount,
        0,
      );
      await pool.query("UPDATE memberships SET role='admin' WHERE user_id=$1", [
        a.id,
      ]);
      assert.equal(
        (
          await request(
            "/admin/items/" + id,
            "PATCH",
            { status: "deactivated_violation", reason: "Violation" },
            a.cookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (await request("/items/" + id, "PATCH", { status: "active" }, a.cookie))
          .status,
        403,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM audit WHERE actor_id=$1",
            [a.id],
          )
        ).rows[0].n,
        1,
      );
      const audit = (
        await pool.query("SELECT * FROM audit WHERE actor_id=$1", [a.id])
      ).rows[0];
      assert.equal(audit.before_data.status, "active");
      assert.equal(audit.after_data.status, "deactivated_violation");
      assert.equal(
        (
          await request(
            "/admin/settings",
            "PATCH",
            { reason: "Invalid", contactEnabled: "bad" },
            a.cookie,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM audit WHERE actor_id=$1",
            [a.id],
          )
        ).rows[0].n,
        1,
      );
      const ride = {
        origin: "Purdue",
        destination: "Chicago",
        departureTime: "2026-11-15T01:00:00Z",
        timeZone: "America/Indiana/Indianapolis",
        feeCents: 1500,
        totalSeats: 3,
        availableSeats: 2,
      };
      assert.equal(
        (
          await request(
            "/rides",
            "POST",
            { ...ride, availableSeats: 4 },
            b.cookie,
          )
        ).status,
        400,
      );
      const rideResult = await request("/rides", "POST", ride, b.cookie);
      assert.equal(rideResult.status, 200);
      assert.equal(
        (await request("/rides?date=2026-11-14")).data.some(
          (r: any) => r.id === rideResult.data.id,
        ),
        true,
      );
      assert.equal(
        (await request("/rides?date=2026-11-15")).data.some(
          (r: any) => r.id === rideResult.data.id,
        ),
        false,
      );
      assert.equal(
        (await request("/favorites/" + rideResult.data.id, "PUT", {}, b.cookie))
          .status,
        404,
      );
      const fav = await request("/items", "POST", item, b.cookie);
      assert.equal(
        (await request("/favorites/" + fav.data.id, "PUT", {}, b.cookie))
          .status,
        200,
      );
      assert.equal(
        (await request("/favorites", "GET", undefined, b.cookie)).data.some(
          (r: any) => r.id === fav.data.id,
        ),
        true,
      );
      const report = await request(
        "/reports",
        "POST",
        {
          targetType: "item",
          targetId: fav.data.id,
          reason: "Misleading",
          details: "",
        },
        c.cookie,
      );
      assert.equal(report.status, 201);
      assert.equal(
        (
          await request(
            "/admin/settings",
            "PATCH",
            { communityAdminUserId: a.id, reason: "Configure notifications" },
            a.cookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            "/admin/reports/" + report.data.id,
            "PATCH",
            {
              status: "violation_confirmed",
              note: "Confirmed",
              reason: "Review",
            },
            a.cookie,
          )
        ).status,
        200,
      );
      await processNotificationJobs(pool);
      const notification = (
        await pool.query(
          "SELECT * FROM notification_jobs WHERE payload->>'userId'=$1 ORDER BY next_attempt_at DESC LIMIT 1",
          [b.id],
        )
      ).rows[0];
      assert.ok(notification.completed_at);
      assert.equal(
        (
          await request(
            "/items/" + fav.data.id,
            "PATCH",
            { status: "active" },
            b.cookie,
          )
        ).status,
        403,
      );
      for (const status of ["reviewed", "dismissed", "violation_confirmed"]) {
        const result = await request(
          "/admin/reports/" + report.data.id,
          "PATCH",
          { status, note: "Decision " + status, reason: "Status transition" },
          a.cookie,
        );
        assert.equal(result.status, 200);
        const jobs = (
          await pool.query(
            "SELECT * FROM notification_jobs WHERE payload->>'reportId'=$1 AND payload->>'kind'='reporter_status_update' ORDER BY next_attempt_at DESC",
            [report.data.id],
          )
        ).rows;
        const newest = jobs[0];
        assert.equal(newest.payload.userId, c.id);
        assert.match(newest.payload.text, /Desk/);
        assert.match(newest.payload.text, new RegExp("Decision " + status));
        assert.match(newest.payload.text, /举报结果 \/ Report update/);
        const before = (
          await pool.query(
            "SELECT count(*)::int n FROM notification_jobs WHERE payload->>'reportId'=$1",
            [report.data.id],
          )
        ).rows[0].n;
        assert.equal(
          (
            await request(
              "/admin/reports/" + report.data.id,
              "PATCH",
              { status, note: "Same state retry", reason: "Retry" },
              a.cookie,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int n FROM notification_jobs WHERE payload->>'reportId'=$1",
              [report.data.id],
            )
          ).rows[0].n,
          before,
        );
        for (let i = 0; i < 5; i++) await processNotificationJobs(pool);
        const delivered = (
          await pool.query("SELECT * FROM messages WHERE client_id=$1", [
            "notification:" + newest.id,
          ])
        ).rows[0];
        assert.ok(delivered);
        assert.equal(delivered.sender_id, a.id);
        const pair = (
          await pool.query("SELECT * FROM conversations WHERE id=$1", [
            delivered.conversation_id,
          ])
        ).rows[0];
        assert.ok([pair.user_a, pair.user_b].includes(c.id));
        assert.ok(![pair.user_a, pair.user_b].includes(b.id));
      }
      const retryId = crypto.randomUUID();
      await pool.query(
        "INSERT INTO notification_jobs(id,payload) VALUES($1,$2)",
        [retryId, { userId: "missing-user", text: "Retry" }],
      );
      await processNotificationJobs(pool);
      const retry = (
        await pool.query("SELECT * FROM notification_jobs WHERE id=$1", [
          retryId,
        ])
      ).rows[0];
      assert.equal(retry.attempts, 1);
      assert.ok(retry.last_error);
      assert.equal(retry.completed_at, null);
      const pagingTitle = "Paging-" + crypto.randomUUID();
      await pool.query(
        "INSERT INTO entities(id,kind,publisher_id,data) SELECT gen_random_uuid(),'item',$1,$2 FROM generate_series(1,52)",
        [b.id, { ...item, title: pagingTitle }],
      );
      const page1 = await request("/items?q=" + pagingTitle);
      assert.equal(page1.data.length, 50);
      assert.ok(page1.nextCursor);
      const page2 = await request(
        "/items?q=" + pagingTitle + "&cursor=" + page1.nextCursor,
      );
      assert.equal(page2.data.length, 2);
      assert.equal(page2.nextCursor, null);
      const expectedMarket = (
        await pool.query(
          "SELECT id FROM entities WHERE data->>'title'=$1 ORDER BY created_at DESC,id DESC",
          [pagingTitle],
        )
      ).rows.map((r) => r.id);
      assert.deepEqual(
        [...page1.data, ...page2.data].map((r: any) => r.id),
        expectedMarket,
      );
      assert.equal(
        new Set([...page1.data, ...page2.data].map((r: any) => r.id)).size,
        52,
      );
      assert.equal((await request("/items?cursor=bad")).status, 400);
      const rideGroup = "Sorted-" + crypto.randomUUID();
      await pool.query(
        "INSERT INTO entities(id,kind,publisher_id,data) SELECT gen_random_uuid(),'ride',$1,$2::jsonb||jsonb_build_object('notes',$3::text,'departureTime',('2027-01-01T00:00:00Z'::timestamptz+(i/5)*interval '1 minute')::text) FROM generate_series(1,53)i",
        [b.id, ride, rideGroup],
      );
      for (const sort of ["departure_asc", "departure_desc"]) {
        const first = await request("/rides?q=" + rideGroup + "&sort=" + sort);
        assert.equal(first.data.length, 50);
        assert.ok(first.nextCursor);
        const second = await request(
          "/rides?q=" +
            rideGroup +
            "&sort=" +
            sort +
            "&cursor=" +
            first.nextCursor,
        );
        const all = [...first.data, ...second.data];
        assert.equal(all.length, 53);
        assert.equal(new Set(all.map((r: any) => r.id)).size, 53);
        const dir = sort === "departure_asc" ? "ASC" : "DESC";
        const expected = (
          await pool.query(
            `SELECT id FROM entities WHERE data->>'notes'=$1 ORDER BY (data->>'departureTime')::timestamptz ${dir},id ${dir}`,
            [rideGroup],
          )
        ).rows.map((r) => r.id);
        assert.deepEqual(
          all.map((r: any) => r.id),
          expected,
        );
        assert.equal(
          (
            await request(
              "/rides?sort=" +
                (sort === "departure_asc"
                  ? "departure_desc"
                  : "departure_asc") +
                "&cursor=" +
                first.nextCursor,
            )
          ).status,
          400,
        );
      }
      const controller = new AbortController();
      const stream = await fetch(base + "/events", {
        headers: { cookie: b.cookie },
        signal: controller.signal,
      });
      const reader = stream.body!.getReader();
      await reader.read();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await request(
        `/conversations/${conversation}/messages`,
        "POST",
        { clientId: crypto.randomUUID(), text: "Realtime" },
        a.cookie,
      );
      const realtime = await reader.read();
      assert.match(new TextDecoder().decode(realtime.value), /event: message/);
      controller.abort();
      assert.equal(
        (
          await request(
            "/admin/users?q=" + a.id + "&role=admin&banned=false",
            "GET",
            undefined,
            a.cookie,
          )
        ).data.length,
        1,
      );
      assert.equal(
        (
          await request(
            "/admin/users?q=" + a.id + "&role=member",
            "GET",
            undefined,
            a.cookie,
          )
        ).data.length,
        0,
      );
      assert.equal(
        (
          await request(
            "/admin/users?q=" + a.id + "&banned=true",
            "GET",
            undefined,
            a.cookie,
          )
        ).data.length,
        0,
      );
      assert.ok(
        (
          await request(
            "/admin/items?publisherId=" + b.id,
            "GET",
            undefined,
            a.cookie,
          )
        ).data.every((r: any) => r.publisherId === b.id),
      );
      assert.equal(
        (
          await request(
            "/admin/items?from=2999-01-01",
            "GET",
            undefined,
            a.cookie,
          )
        ).data.length,
        0,
      );
      assert.equal(
        (
          await request(
            "/admin/rides?publisherId=" +
              b.id +
              "&origin=Purdue&destination=Chicago&date=2026-11-14",
            "GET",
            undefined,
            a.cookie,
          )
        ).data.some((r: any) => r.id === rideResult.data.id),
        true,
      );
      const reportFilter =
        "/admin/reports?targetType=item&reason=Misleading&targetId=" +
        fav.data.id +
        "&reporterId=" +
        c.id;
      assert.equal(
        (await request(reportFilter, "GET", undefined, a.cookie)).data.length,
        1,
      );
      assert.equal(
        (
          await request(
            reportFilter + "&from=2999-01-01",
            "GET",
            undefined,
            a.cookie,
          )
        ).data.length,
        0,
      );
      assert.equal(
        (
          await request(
            "/admin/audit?actorId=" +
              a.id +
              "&resource=items&resourceId=" +
              id +
              "&action=PATCH",
            "GET",
            undefined,
            a.cookie,
          )
        ).data.length,
        1,
      );
      assert.equal(
        (
          await request(
            "/admin/audit?actorId=" + b.id + "&resourceId=" + id,
            "GET",
            undefined,
            a.cookie,
          )
        ).data.length,
        0,
      );
      assert.equal(
        (
          await request(
            "/admin/conversations?from=2999-01-01",
            "GET",
            undefined,
            a.cookie,
          )
        ).data.length,
        0,
      );
      const contact = await request("/contact", "POST", {
        email: "contact@purdue.edu",
        subject: "Contact " + crypto.randomUUID(),
        message: "Question",
      });
      assert.equal(contact.status, 201);
      assert.equal(
        (
          await request(
            "/admin/contact/" + contact.data.id,
            "PATCH",
            { status: "resolved", note: "Handled", reason: "Resolve" },
            a.cookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            "/admin/contact?q=" + contact.data.id + "&status=resolved",
            "GET",
            undefined,
            a.cookie,
          )
        ).data.length,
        1,
      );
      assert.equal(
        (
          await request(
            "/admin/contact?q=" + contact.data.id + "&status=open",
            "GET",
            undefined,
            a.cookie,
          )
        ).data.length,
        0,
      );
      const contactAudit = (
        await pool.query(
          "SELECT * FROM audit WHERE target_id=$1 AND action LIKE '%contact%'",
          [contact.data.id],
        )
      ).rows[0];
      assert.equal(contactAudit.before_data.status, "open");
      assert.equal(contactAudit.after_data.status, "resolved");
      const delegated = await request(
        "/admin/items",
        "POST",
        { ...item, publisherId: b.id, reason: "Publish on behalf" },
        a.cookie,
      );
      assert.equal(delegated.status, 200);
      assert.equal(delegated.data.publisherId, b.id);
      assert.ok((await request("/items?status=")).data.length > 0);
      const reported = await request("/items", "POST", item, b.cookie);
      await pool.query("UPDATE entities SET status='reported' WHERE id=$1", [
        reported.data.id,
      ]);
      assert.equal(
        (
          await request(
            "/items/" + reported.data.id,
            "PATCH",
            { status: "active" },
            b.cookie,
          )
        ).status,
        403,
      );
      const race = await request("/items", "POST", item, b.cookie);
      const lock = await pool.connect();
      try {
        await lock.query("BEGIN");
        await lock.query(
          "UPDATE entities SET status='deactivated_violation' WHERE id=$1",
          [race.data.id],
        );
        const attempt = request(
          "/items/" + race.data.id,
          "PATCH",
          { status: "active" },
          b.cookie,
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
        await lock.query("COMMIT");
        assert.equal((await attempt).status, 403);
        assert.equal(
          (
            await pool.query("SELECT status FROM entities WHERE id=$1", [
              race.data.id,
            ])
          ).rows[0].status,
          "deactivated_violation",
        );
      } finally {
        await lock.query("ROLLBACK");
        lock.release();
      }
      const auditBefore = (
        await pool.query(
          "SELECT count(*)::int n FROM audit WHERE actor_id=$1",
          [a.id],
        )
      ).rows[0].n;
      assert.equal(
        (
          await request(
            "//admin/users",
            "POST",
            {
              email: "bypass@purdue.edu",
              name: "Bypass",
              password: "Managed-password-123",
              reason: "Bypass",
            },
            a.cookie,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            "/admin/items/" + id,
            "PUT",
            { title: "Wrong method", reason: "Wrong method" },
            a.cookie,
          )
        ).status,
        405,
      );
      assert.equal(
        (
          await request(
            "/admin/settings",
            "PATCH",
            { contactEnabled: false },
            a.cookie,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            "/admin/settings",
            "PATCH",
            { contactEnabled: false, reason: "Unauthorized" },
            b.cookie,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM audit WHERE actor_id=$1",
            [a.id],
          )
        ).rows[0].n,
        auditBefore,
      );
      assert.equal(
        (
          await pool.query('SELECT id FROM "user" WHERE email=$1', [
            "bypass@purdue.edu",
          ])
        ).rowCount,
        0,
      );
      const invalidId = await request("/items/private-invalid-input");
      assert.equal(invalidId.status, 400);
      assert.equal(invalidId.error.message, "Invalid request data");
      assert.doesNotMatch(
        invalidId.error.message,
        /private-invalid-input|uuid/,
      );
      const managedEmail = `managed-${crypto.randomUUID()}@purdue.edu`;
      const managed = await request(
        "/admin/users",
        "POST",
        {
          email: managedEmail,
          name: "Managed",
          password: "Managed-password-123",
          reason: "Provision",
        },
        a.cookie,
      );
      assert.equal(managed.status, 201, JSON.stringify(managed));
      assert.equal(managed.data.emailVerified, false);
      assert.equal(
        (
          await request(
            "/admin/users/" + managed.data.id + "/password",
            "POST",
            { password: "Replacement-password-456", reason: "Rotate" },
            a.cookie,
          )
        ).status,
        200,
      );
      await pool.query("UPDATE memberships SET role='admin' WHERE user_id=$1", [
        b.id,
      ]);
      await pool.query(
        "UPDATE settings SET data=jsonb_set(data,'{communityAdminUserId}',to_jsonb($1::text)) WHERE id=true",
        [b.id],
      );
      const communityText = "Official " + crypto.randomUUID();
      const community = await request(
        "/admin/community-messages",
        "POST",
        { userId: c.id, text: communityText, reason: "Official support" },
        a.cookie,
      );
      assert.equal(community.status, 200, JSON.stringify(community));
      const official = (
        await pool.query(
          "SELECT * FROM messages WHERE conversation_id=$1 AND text=$2",
          [community.data.id, communityText],
        )
      ).rows[0];
      assert.equal(official.sender_id, b.id);
      const officialAudit = (
        await pool.query("SELECT * FROM audit WHERE target_id=$1", [
          community.data.id,
        ])
      ).rows[0];
      assert.equal(officialAudit.actor_id, a.id);
      const unrelated = await request(
        "/conversations",
        "POST",
        { otherUserId: c.id },
        a.cookie,
      );
      const officialList = await request(
        "/admin/community-messages",
        "GET",
        undefined,
        a.cookie,
      );
      assert.equal(
        officialList.data.some((r: any) => r.id === community.data.id),
        true,
      );
      assert.equal(
        officialList.data.some((r: any) => r.id === unrelated.data.id),
        false,
      );
      assert.equal(
        (
          await request(
            "/admin/community-messages/" + unrelated.data.id,
            "GET",
            undefined,
            a.cookie,
          )
        ).status,
        403,
      );
      for (let i = 0; i < 60; i++)
        assert.equal(
          (
            await request(
              "/conversations/" + community.data.id + "/messages",
              "POST",
              { clientId: "limit-" + i, text: "Bounded " + i },
              c.cookie,
            )
          ).status,
          200,
        );
      assert.equal(
        (
          await request(
            "/conversations/" + community.data.id + "/messages",
            "POST",
            { clientId: "over-limit", text: "Blocked" },
            c.cookie,
          )
        ).status,
        429,
      );
      const eligibilityJob = crypto.randomUUID();
      await pool.query(
        "INSERT INTO notification_jobs(id,payload) VALUES($1,$2)",
        [eligibilityJob, { userId: c.id, text: "Eligibility retry" }],
      );
      try {
        await pool.query('UPDATE "user" SET banned=true WHERE id=$1', [b.id]);
        await processNotificationJobs(pool);
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int n FROM messages WHERE client_id=$1",
              ["notification:" + eligibilityJob],
            )
          ).rows[0].n,
          0,
        );
        let job = (
          await pool.query("SELECT * FROM notification_jobs WHERE id=$1", [
            eligibilityJob,
          ])
        ).rows[0];
        assert.equal(job.completed_at, null);
        assert.equal(job.attempts, 1);
        assert.ok(job.last_error);
        await pool.query('UPDATE "user" SET banned=false WHERE id=$1', [b.id]);
        await pool.query(
          "UPDATE memberships SET role='member' WHERE user_id=$1",
          [b.id],
        );
        await pool.query(
          "UPDATE notification_jobs SET next_attempt_at=now() WHERE id=$1",
          [eligibilityJob],
        );
        await processNotificationJobs(pool);
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int n FROM messages WHERE client_id=$1",
              ["notification:" + eligibilityJob],
            )
          ).rows[0].n,
          0,
        );
        job = (
          await pool.query("SELECT * FROM notification_jobs WHERE id=$1", [
            eligibilityJob,
          ])
        ).rows[0];
        assert.equal(job.attempts, 2);
        assert.equal(job.completed_at, null);
        await pool.query(
          "UPDATE memberships SET role='admin' WHERE user_id=$1",
          [b.id],
        );
        await pool.query('UPDATE "user" SET banned=true WHERE id=$1', [c.id]);
        await pool.query(
          "UPDATE notification_jobs SET next_attempt_at=now() WHERE id=$1",
          [eligibilityJob],
        );
        await processNotificationJobs(pool);
        await processNotificationJobs(pool);
        assert.ok(
          (
            await pool.query(
              "SELECT completed_at FROM notification_jobs WHERE id=$1",
              [eligibilityJob],
            )
          ).rows[0].completed_at,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int n FROM messages WHERE client_id=$1",
              ["notification:" + eligibilityJob],
            )
          ).rows[0].n,
          1,
        );
      } finally {
        await pool.query(
          'UPDATE "user" SET banned=false WHERE id=ANY($1::text[])',
          [[b.id, c.id]],
        );
        await pool.query(
          "UPDATE memberships SET role='admin' WHERE user_id=$1",
          [b.id],
        );
      }
      await pool.query(
        "ALTER TABLE audit ADD CONSTRAINT api_test_audit_rollback CHECK(reason<>'rollback-test')",
      );
      const failedEmail = `failed-${crypto.randomUUID()}@purdue.edu`;
      try {
        assert.equal(
          (
            await request(
              "/admin/users",
              "POST",
              {
                email: failedEmail,
                name: "Rollback",
                password: "Managed-password-123",
                reason: "rollback-test",
              },
              a.cookie,
            )
          ).status,
          500,
        );
        assert.equal(
          (
            await pool.query('SELECT id FROM "user" WHERE email=$1', [
              failedEmail,
            ])
          ).rowCount,
          0,
        );
      } finally {
        await pool.query(
          "ALTER TABLE audit DROP CONSTRAINT api_test_audit_rollback",
        );
      }
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await pool.end();
    }
  },
);
