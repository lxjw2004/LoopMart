import test from "node:test";
import assert from "node:assert/strict";
import { api, auth } from "./api.js";
import { RequestError, errorText } from "./errors.js";

test("preserves failure status/code and renders unavailable, bad credentials and forbidden in both languages", async () => {
  const original = globalThis.fetch;
  try {
    for (const entry of [
      {
        status: 503,
        code: "HTTP_ERROR",
        message: "Password reset is unavailable",
        zh: "邮件服务暂不可用，请稍后重试",
        en: "Email service is unavailable. Try again later.",
      },
      {
        status: 503,
        code: "MAIL_UNAVAILABLE",
        message: "SMTP unavailable",
        zh: "邮件服务暂不可用，请稍后重试",
        en: "Email service is unavailable. Try again later.",
      },
      {
        status: 401,
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
        zh: "邮箱或密码不正确",
        en: "Email or password is incorrect.",
      },
      {
        status: 403,
        code: "FORBIDDEN",
        message: "Administrator required",
        zh: "没有权限执行此操作",
        en: "You do not have permission to perform this action.",
      },
    ]) {
      globalThis.fetch = async (input) =>
        new Response(
          JSON.stringify(
            String(input).startsWith("/api/auth/")
              ? { code: entry.code, message: entry.message }
              : { error: { code: entry.code, message: entry.message } },
          ),
          { status: entry.status },
        );
      for (const action of [
        () => api("/me"),
        () => auth("sign-in/email", {}),
      ]) {
        await assert.rejects(action(), (error) => {
          assert.ok(error instanceof RequestError);
          assert.equal(error.status, entry.status);
          assert.equal(error.code, entry.code);
          assert.equal(errorText(error, false), entry.zh);
          assert.equal(errorText(error, true), entry.en);
          return true;
        });
      }
    }
  } finally {
    globalThis.fetch = original;
  }
});
test("localizes network failures, hides server internals and retains local validation", () => {
  assert.match(errorText(new TypeError("Failed to fetch"), false), /网络/);
  assert.match(errorText(new TypeError("Failed to fetch"), true), /network/i);
  assert.equal(
    errorText(new Error("请输入有效美元金额，最多两位小数"), false),
    "请输入有效美元金额，最多两位小数",
  );
  assert.doesNotMatch(
    errorText(
      new RequestError(500, "INTERNAL_ERROR", "SQL secret failure"),
      false,
    ),
    /SQL|secret/,
  );
});
