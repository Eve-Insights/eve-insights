CREATE TABLE `evaluations` (
	`run_id` varchar(256) NOT NULL,
	`evaluation_id` varchar(256) NOT NULL,
	`description` text,
	`tags` json,
	`timeout_ms` int unsigned,
	`status` varchar(16) NOT NULL,
	`started_at` varchar(64),
	`completed_at` varchar(64),
	`verdict` varchar(16),
	`error` text,
	`skip_reason` text,
	`assertion_count` int unsigned,
	`passed_assertion_count` int unsigned,
	`failed_assertion_count` int unsigned,
	CONSTRAINT `evaluations_run_id_evaluation_id_pk` PRIMARY KEY(`run_id`,`evaluation_id`)
);
--> statement-breakpoint
CREATE TABLE `event_chunks` (
	`run_id` varchar(256) NOT NULL,
	`event_id` varchar(256) NOT NULL,
	`chunk_index` int unsigned NOT NULL,
	`data` mediumtext NOT NULL,
	`byte_length` int unsigned NOT NULL,
	CONSTRAINT `event_chunks_run_id_event_id_chunk_index_pk` PRIMARY KEY(`run_id`,`event_id`,`chunk_index`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`run_id` varchar(256) NOT NULL,
	`event_id` varchar(256) NOT NULL,
	`sequence` int unsigned NOT NULL,
	`type` varchar(32) NOT NULL,
	`occurred_at` varchar(64) NOT NULL,
	`projection` json NOT NULL,
	`payload_encoding` varchar(16) NOT NULL,
	`payload_content_type` varchar(128) NOT NULL,
	`payload_byte_length` int unsigned NOT NULL,
	`payload_chunk_size` int unsigned NOT NULL,
	`payload_chunk_count` int unsigned NOT NULL,
	`payload_sha256` char(64) NOT NULL,
	`status` varchar(16) NOT NULL,
	`committed_at` varchar(64),
	CONSTRAINT `events_run_id_event_id_pk` PRIMARY KEY(`run_id`,`event_id`)
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`run_id` varchar(256) NOT NULL,
	`agent_id` varchar(256) NOT NULL,
	`started_at` varchar(64) NOT NULL,
	`kind` varchar(16) NOT NULL,
	`url` text NOT NULL,
	`name` varchar(256) NOT NULL,
	`capabilities` json NOT NULL,
	`status` varchar(16) NOT NULL,
	`evaluation_count` int unsigned NOT NULL,
	`counts` json NOT NULL,
	`last_event_sequence` int NOT NULL DEFAULT -1,
	`completed_at` varchar(64),
	CONSTRAINT `runs_run_id_pk` PRIMARY KEY(`run_id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`run_id` varchar(256) NOT NULL,
	`session_id` varchar(256) NOT NULL,
	`evaluation_id` varchar(256) NOT NULL,
	`is_primary` boolean NOT NULL,
	`started_at` varchar(64) NOT NULL,
	`trace_context` json,
	CONSTRAINT `sessions_run_id_session_id_pk` PRIMARY KEY(`run_id`,`session_id`)
);
--> statement-breakpoint
CREATE INDEX `events_run_status_idx` ON `events` (`run_id`,`status`);--> statement-breakpoint
CREATE INDEX `runs_agent_started_idx` ON `runs` (`agent_id`,`started_at`);