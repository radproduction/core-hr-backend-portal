CREATE TABLE `absenteeismPredictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`predictionDate` timestamp NOT NULL,
	`targetPeriodStart` timestamp NOT NULL,
	`targetPeriodEnd` timestamp NOT NULL,
	`riskScore` int NOT NULL,
	`riskLevel` enum('low','medium','high') NOT NULL,
	`factors` json,
	`recommendation` text,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `absenteeismPredictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendanceAnomalyFlags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`attendanceRecordId` int,
	`date` timestamp NOT NULL,
	`type` enum('creeping_lateness','geo_fence_violation','buddy_punching','unusual_pattern','excessive_overtime','irregular_hours') NOT NULL,
	`severity` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`description` text NOT NULL,
	`aiReasoning` text,
	`status` enum('pending_review','reviewed_ok','reviewed_action','dismissed') NOT NULL DEFAULT 'pending_review',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`reviewNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendanceAnomalyFlags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendanceRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`date` timestamp NOT NULL,
	`clockIn` timestamp,
	`clockOut` timestamp,
	`clockInLat` varchar(30),
	`clockInLng` varchar(30),
	`clockOutLat` varchar(30),
	`clockOutLng` varchar(30),
	`geoFenceId` int,
	`geoFenceStatus` enum('inside','outside','unknown') DEFAULT 'unknown',
	`shiftId` int,
	`status` enum('present','absent','late','early_leave','half_day','on_leave','holiday','weekend','overtime') NOT NULL DEFAULT 'absent',
	`source` enum('web','mobile','biometric','csv_import','manual') NOT NULL DEFAULT 'web',
	`workMinutes` int DEFAULT 0,
	`overtimeMinutes` int DEFAULT 0,
	`lateMinutes` int DEFAULT 0,
	`earlyLeaveMinutes` int DEFAULT 0,
	`notes` text,
	`correctedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendanceRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geoFences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`locationId` int,
	`name` varchar(200) NOT NULL,
	`lat` varchar(30) NOT NULL,
	`lng` varchar(30) NOT NULL,
	`radiusMeters` int NOT NULL DEFAULT 200,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	CONSTRAINT `geoFences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `overtimeRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`attendanceRecordId` int,
	`date` timestamp NOT NULL,
	`requestedMinutes` int NOT NULL,
	`approvedMinutes` int,
	`reason` text,
	`status` enum('pending','approved','rejected','auto_approved') NOT NULL DEFAULT 'pending',
	`approvedBy` int,
	`approvedAt` timestamp,
	`workflowInstanceId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `overtimeRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `punchImportJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`source` enum('biometric','csv','excel','api') NOT NULL DEFAULT 'csv',
	`totalRows` int NOT NULL DEFAULT 0,
	`successRows` int NOT NULL DEFAULT 0,
	`errorRows` int NOT NULL DEFAULT 0,
	`errorReport` json,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `punchImportJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shiftRosters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`shiftId` int,
	`date` timestamp NOT NULL,
	`isRestDay` boolean NOT NULL DEFAULT false,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	CONSTRAINT `shiftRosters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`startTime` varchar(10) NOT NULL,
	`endTime` varchar(10) NOT NULL,
	`graceMinutes` int NOT NULL DEFAULT 0,
	`breakMinutes` int NOT NULL DEFAULT 0,
	`isFlexible` boolean NOT NULL DEFAULT false,
	`isOvernight` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	CONSTRAINT `shifts_id` PRIMARY KEY(`id`)
);
