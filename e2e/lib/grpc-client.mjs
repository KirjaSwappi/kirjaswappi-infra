import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GRPC_URL = process.env.GRPC_URL || 'localhost:50051';
const API_KEY = process.env.NOTIFICATION_API_KEY || 'ci-test-api-key';

let client = null;

export function getNotificationClient() {
  if (client) return client;

  const PROTO_PATH = resolve(__dirname, '../../kirjaswappi-notification/proto/notification.proto');

  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [resolve(__dirname, '../../kirjaswappi-notification/proto')],
  });

  const proto = grpc.loadPackageDefinition(packageDefinition);
  client = new proto.notification.NotificationService(
    GRPC_URL,
    grpc.credentials.createInsecure(),
  );

  return client;
}

export function sendNotification(userId, title, message) {
  const notifClient = getNotificationClient();

  const metadata = new grpc.Metadata();
  metadata.add('x-api-key', API_KEY);

  return new Promise((resolve, reject) => {
    notifClient.SendNotification(
      {
        userId,
        title,
        message,
        time: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
      },
      metadata,
      (err, response) => {
        if (err) reject(err);
        else resolve(response);
      },
    );
  });
}
