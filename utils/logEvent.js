import { readJSON, writeJSON } from "./db.js";

const PATH = "./data/logs.json";

const REQUIRED_FIELDS = {
  JOIN: ["username", "by"],
  KICK: ["username", "by"],
  PROMOTE: ["username", "by", "to"],
  DEMOTE: ["username", "by", "to"],
  WARN: ["username", "by", "reason"],
  BLACKLIST: ["username", "by", "reason"]
};

/**
 * Logs an event to logs.json
 * Supports JOIN, KICK, PROMOTE, DEMOTE, WARN, BLACKLIST
 * For JOIN, optional fields: name, rank, joinedAt, warnings
 */
export function logEvent(type, payload = {}) {
  if (!type) throw new Error("logEvent: type is required");

  // Validate payload against required fields
  const schema = REQUIRED_FIELDS[type];
  if (schema) {
    for (const field of schema) {
      if (!payload[field]) {
        throw new Error(`logEvent(${type}): missing field '${field}'`);
      }
    }
  }

  // Read current logs from file, fallback to empty array
  const logs = readJSON(PATH, []);

  const event = {
    type,
    username: payload.username ?? "",
    by: payload.by ?? "",
    timestamp: payload.timestamp ?? new Date().toISOString()
  };

  // Optional fields based on type
  if (payload.to) event.to = payload.to;
  if (payload.reason) event.reason = payload.reason;
  if (payload.details) event.details = payload.details; // optional details field

  // Extra fields for JOIN events
  if (type === "JOIN") {
    if (payload.name) event.name = payload.name;
    if (payload.rank) event.rank = payload.rank;
    if (payload.joinedAt) event.joinedAt = payload.joinedAt;
    if (payload.warnings !== undefined) event.warnings = payload.warnings;
  }

  // Append new event without overwriting old logs
  logs.push(event);
  writeJSON(PATH, logs);

  return event;
}
