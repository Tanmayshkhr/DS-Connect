from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app.config import settings

mail_config = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)


async def send_otp_email(to_email: str, otp: str) -> None:
    message = MessageSchema(
        subject="Your DS Connect Login OTP",
        recipients=[to_email],
        body=(
            f"Your DS Connect login OTP is: {otp}\n\n"
            "This code expires in 5 minutes. Do not share it with anyone."
        ),
        subtype=MessageType.plain,
    )
    fast_mail = FastMail(mail_config)
    await fast_mail.send_message(message)
