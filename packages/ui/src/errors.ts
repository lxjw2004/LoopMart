export class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

/** Only known, user-actionable failures reach the interface; transport details stay private. */
export function errorText(error: unknown, english: boolean): string {
  const say = (zh: string, en: string) => (english ? en : zh);
  if (error instanceof RequestError) {
    const hint = `${error.code} ${error.message}`.toLowerCase();
    if (
      /smtp|mail_unavailable|email.*service.*unavailable|mail.*not.*configured|password.*reset.*unavailable/.test(
        hint,
      )
    )
      return say(
        "邮件服务暂不可用，请稍后重试",
        "Email service is unavailable. Try again later.",
      );
    if (/email.*verif|verif.*email/.test(hint))
      return say(
        "请先验证邮箱后再继续",
        "Verify your email before continuing.",
      );
    if (
      /invalid.*(?:email.*password|credentials)|incorrect.*password|invalid_password/.test(
        hint,
      )
    )
      return say("邮箱或密码不正确", "Email or password is incorrect.");
    if (/banned|suspended/.test(hint))
      return say("账号已封禁", "Your account is suspended.");
    if (/email.*domain|domain.*not.*allowed/.test(hint))
      return say(
        "此邮箱后缀暂不支持注册",
        "This email domain is not eligible for registration.",
      );
    if (error.status === 401)
      return say("请先登录后再继续", "Sign in before continuing.");
    if (error.status === 403)
      return say(
        "没有权限执行此操作",
        "You do not have permission to perform this action.",
      );
    if (error.status === 400 || error.status === 422)
      return say("请检查填写内容后重试", "Check your entries and try again.");
    if (error.status === 404)
      return say("内容不存在或已不可用", "This content is unavailable.");
    if (error.status === 409)
      return say(
        "内容已发生变化，请刷新后重试",
        "This content has changed. Refresh and try again.",
      );
    if (error.status === 429)
      return say(
        "操作过于频繁，请稍后重试",
        "Too many requests. Try again later.",
      );
    if (error.status === 503)
      return say(
        "服务暂不可用，请稍后重试",
        "The service is unavailable. Try again later.",
      );
    return say(
      "服务出现问题，请稍后重试",
      "Something went wrong. Try again later.",
    );
  }
  if (
    error instanceof Error &&
    !(error instanceof TypeError) &&
    !(error instanceof SyntaxError)
  ) {
    const local: Record<string, [string, string]> = {
      "Action cancelled": ["操作已取消", "Action cancelled"],
      "Community administrator unavailable": [
        "未设置社区管理员",
        "Community administrator unavailable",
      ],
      "Invalid departure time": [
        "请输入有效出发时间",
        "Enter a valid departure time.",
      ],
      "Departure time does not exist in this time zone": [
        "此时区不存在该出发时间，请重新选择",
        "This departure time does not exist in the selected time zone.",
      ],
      "Enter a valid USD amount with at most two decimal places": [
        "请输入有效美元金额，最多两位小数",
        "Enter a valid USD amount with at most two decimal places",
      ],
    };
    const entry =
      local[error.message] ||
      Object.values(local).find((values) => values.includes(error.message));
    if (entry) return entry[english ? 1 : 0];
  }
  return say(
    "网络连接异常，请检查连接后重试",
    "A network error occurred. Check your connection and try again.",
  );
}
