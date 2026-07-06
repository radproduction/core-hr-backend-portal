CREATE TABLE `appraisalCycles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`periodLabel` varchar(100),
	`cycleType` enum('annual','mid_year','quarterly','probation','custom') NOT NULL DEFAULT 'annual',
	`templateId` int NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`selfReviewDeadline` timestamp,
	`managerReviewDeadline` timestamp,
	`calibrationDeadline` timestamp,
	`status` enum('draft','active','self_review','manager_review','calibration','completed','archived') NOT NULL DEFAULT 'draft',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appraisalCycles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appraisalQuestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sectionId` int NOT NULL,
	`questionText` text NOT NULL,
	`questionType` enum('rating','text','yes_no','multi_choice') NOT NULL DEFAULT 'rating',
	`raterType` enum('self','manager','peer','all') NOT NULL DEFAULT 'all',
	`weight` decimal(5,2) DEFAULT '1',
	`options` json,
	`isRequired` boolean NOT NULL DEFAULT true,
	`displayOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `appraisalQuestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appraisalSections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`sectionType` enum('kpi','competency','questionnaire','development') NOT NULL DEFAULT 'questionnaire',
	`weight` decimal(5,2) DEFAULT '0',
	`displayOrder` int NOT NULL DEFAULT 0,
	`isRequired` boolean NOT NULL DEFAULT true,
	CONSTRAINT `appraisalSections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appraisalTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`templateType` enum('managerial','non_managerial','universal') NOT NULL DEFAULT 'universal',
	`scoringPolicy` json,
	`incrementPolicy` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appraisalTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cycleParticipants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cycleId` int NOT NULL,
	`employeeId` int NOT NULL,
	`managerId` int,
	`status` enum('pending','self_submitted','manager_submitted','calibrated','acknowledged') NOT NULL DEFAULT 'pending',
	`selfScore` decimal(5,2),
	`managerScore` decimal(5,2),
	`finalScore` decimal(5,2),
	`incrementPercent` decimal(5,2),
	`incrementAmount` decimal(12,2),
	`managerNotes` text,
	`aiGeneratedReview` text,
	`finalReview` text,
	`biasFlagsJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cycleParticipants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evaluationRatings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`participantId` int NOT NULL,
	`questionId` int NOT NULL,
	`raterId` int NOT NULL,
	`raterType` enum('self','manager','peer') NOT NULL,
	`ratingValue` varchar(100),
	`ratingText` text,
	`submittedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evaluationRatings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kpiDefinitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`companyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`measurementUnit` varchar(100),
	`targetType` enum('numeric','percentage','boolean','text') NOT NULL DEFAULT 'numeric',
	`defaultTarget` varchar(100),
	`weight` decimal(5,2) DEFAULT '1',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kpiDefinitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kpiGroups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`designationId` int,
	`departmentId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kpiGroups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `participantKpis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`participantId` int NOT NULL,
	`kpiDefinitionId` int,
	`customTitle` varchar(255),
	`target` varchar(100),
	`actual` varchar(100),
	`score` decimal(5,2),
	`weight` decimal(5,2) DEFAULT '1',
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `participantKpis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `performanceAuditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`actorId` int,
	`entityType` varchar(100) NOT NULL,
	`entityId` int,
	`action` varchar(100) NOT NULL,
	`oldValue` json,
	`newValue` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `performanceAuditLog_id` PRIMARY KEY(`id`)
);
