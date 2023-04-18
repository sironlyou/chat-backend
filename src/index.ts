import { makeExecutableSchema } from "@graphql-tools/schema";
import { PrismaClient } from "@prisma/client";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@apollo/server/express4";
import express from "express";
import { PubSub } from "graphql-subscriptions";
import { useServer } from "graphql-ws/lib/use/ws";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { getSession } from "next-auth/react";
import resolvers from "./graphql/resolvers";
import typeDefs from "./graphql/typeDefs";
import { GraphQLContext, Session, SubscriptionContext } from "./utils/types";
import * as dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import { json } from "body-parser";
import path from "path";
const EasyYandexS3 = require("easy-yandex-s3").default;
const main = async () => {
  dotenv.config();

  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  const app = express();
  const httpServer = createServer(app);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql/subscriptions",
  });

  // Context parameters
  const prisma = new PrismaClient();
  const pubsub = new PubSub();

  let s3 = new EasyYandexS3({
    auth: {
      secretAccessKey: "YCMdr01qyn-8ESDdotGWoMmi3QlNRhpiIdUg0QNe",
      accessKeyId: "YCAJEFgdsD8gRK8ZI076HYV1w",
    },
    Bucket: "boost.img", // например, "my-storage",
    debug: true, // Дебаг в консоли, потом можете удалить в релизе
  });

  const getSubscriptionContext = async (
    ctx: SubscriptionContext
  ): Promise<GraphQLContext> => {
    ctx;
    if (ctx.connectionParams && ctx.connectionParams.session) {
      const { session } = ctx.connectionParams;
      return { session, prisma, pubsub };
    }
    return { session: null, prisma, pubsub };
  };

  const serverCleanup = useServer(
    {
      schema,
      context: (ctx: SubscriptionContext) => {
        return getSubscriptionContext(ctx);
      },
    },
    wsServer
  );
  const server = new ApolloServer({
    schema,
    csrfPrevention: true,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),

      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });
  await server.start();

  const corsOptions = {
    origin: process.env.CLIENT_ORIGIN,

    credentials: true,
  };
  app.use(multer().any(), cors<cors.CorsRequest>(corsOptions));
  app.post("/uploadFile", async (req, res) => {
    if (typeof req.files === "undefined") return;
    // if (!req.files[0]) return;
    //@ts-ignore
    let buffer: Buffer = req.files[0].buffer; // Буфер загруженного файла
    let upload = await s3.Upload({ buffer }, "/files/"); // Загрузка в бакет
    res.send(upload); // Ответ сервера - ответ от Yandex Object Storage
    console.log("upload", upload.Location);
  });
  app.use(
    "/graphql",
    cors<cors.CorsRequest>(corsOptions),
    json(),
    expressMiddleware(server, {
      context: async ({ req }): Promise<GraphQLContext> => {
        const session = await getSession({ req });

        return { session: session as Session, prisma, pubsub };
      },
    })
  );

  const PORT = 4000;

  await new Promise<void>((resolve) =>
    httpServer.listen({ port: PORT }, resolve)
  );
  console.log(`Server is now running on http://localhost:${PORT}/graphql`);
};

main().catch((err) => console.log(err));
