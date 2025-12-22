// nest-api/src/main.ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      "https://cms.godcomfortword.com",
      "https://gods-comfort-word-cms.web.app",
      "https://gods-comfort-word-cms.firebaseapp.com",
      "https://www.godcomfortword.com",
      "https://godcomfortword.com",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  const port = process.env.PORT || 8080;
  await app.listen(port, "0.0.0.0");
  console.log(`🚀 Nest API running on ${port}`);
}

bootstrap();
