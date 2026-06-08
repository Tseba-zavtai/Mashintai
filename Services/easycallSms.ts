// Services/easycallSms.ts

type SendOtpSmsArgs = {
  apiKey: string;
  phone: string; // 8 оронтой: 95100156
  code: string;
};

export async function sendOtpSms({ apiKey, phone, code }: SendOtpSmsArgs): Promise<string> {
  const url = "https://dash.easycall.mn/api_v1/send_sms_api";

  const payload = {
    api_key: apiKey,
    phone: phone, // EasyCall OTP API нь 8 оронтойгоор авдаг
    message: `Tureestei batalgaajuulah code: ${code}`,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.message || "SMS илгээхэд алдаа гарлаа");
  }

  return data.message; // "SMS хүлээгдэж байгаа жагсаалтанд амжилттай нэмэгдлээ."
}
