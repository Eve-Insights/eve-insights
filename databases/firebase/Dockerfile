# There is no official Firebase emulator image, so build one:
# firebase-tools on Node, plus a JRE (Firestore, Database, Pub/Sub emulators are Java).
FROM node:24-bookworm-slim

ARG FIREBASE_TOOLS_VERSION=14.19.0

RUN apt-get update \
  && apt-get install --no-install-recommends -y default-jre-headless \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g firebase-tools@${FIREBASE_TOOLS_VERSION}

# Pre-download the emulator jars so a container start does not hit the network.
RUN firebase setup:emulators:firestore \
  && firebase setup:emulators:database \
  && firebase setup:emulators:pubsub \
  && firebase setup:emulators:storage \
  && firebase setup:emulators:ui

WORKDIR /srv/firebase
RUN mkdir -p /srv/firebase/data

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# UI, hub, logging, firestore, pub/sub, database, auth, storage
EXPOSE 4000 4400 4500 8080 8085 9000 9099 9199

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
