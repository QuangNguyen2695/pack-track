export class RequestAuthRescue {
  identifier: string = ""; // email hoặc phone
  purpose: string = "";
}

export class VerifyAuthRescue {
  identifier: string = "";
  purpose: string = "";
  token: string = "";
}

export class RequestForgotPassword {
  identifier: string = "";
  redirectBaseUrl?: string = "";
}

export class RequestResetPassword {
  token: string = "";
  newPassword: string = "";
}
