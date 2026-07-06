CREATE TABLE `bulkUploadJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`uploadedBy` int NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileKey` varchar(500),
	`totalRows` int NOT NULL DEFAULT 0,
	`successRows` int NOT NULL DEFAULT 0,
	`errorRows` int NOT NULL DEFAULT 0,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`errorReport` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `bulkUploadJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employeeAssets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`assetName` varchar(255) NOT NULL,
	`assetType` enum('laptop','mobile','tablet','vehicle','access_card','uniform','tools','other') NOT NULL,
	`serialNumber` varchar(100),
	`assetTag` varchar(100),
	`assignedDate` timestamp NOT NULL,
	`returnDate` timestamp,
	`condition` enum('new','good','fair','damaged','lost') NOT NULL DEFAULT 'good',
	`conditionOnReturn` enum('new','good','fair','damaged','lost'),
	`notes` text,
	`status` enum('assigned','returned','lost') NOT NULL DEFAULT 'assigned',
	`assignedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employeeAssets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employeeDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`documentType` enum('passport','national_id','visa','work_permit','driving_license','degree','certificate','contract','nda','offer_letter','appraisal','warning_letter','other') NOT NULL,
	`title` varchar(255) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileSize` int,
	`mimeType` varchar(100),
	`expiryDate` timestamp,
	`isVerified` boolean NOT NULL DEFAULT false,
	`verifiedBy` int,
	`verifiedAt` timestamp,
	`notes` text,
	`uploadedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employeeDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employeeExits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`exitType` enum('resignation','termination','retirement','end_of_contract','redundancy','death','absconding') NOT NULL,
	`lastWorkingDay` timestamp NOT NULL,
	`noticeDate` timestamp,
	`reason` text,
	`checklistAssetsReturned` boolean NOT NULL DEFAULT false,
	`checklistAccessRevoked` boolean NOT NULL DEFAULT false,
	`checklistDocumentsHandedOver` boolean NOT NULL DEFAULT false,
	`checklistFinancialClearance` boolean NOT NULL DEFAULT false,
	`checklistExitInterviewDone` boolean NOT NULL DEFAULT false,
	`exitInterviewNotes` text,
	`status` enum('initiated','in_progress','cleared','completed') NOT NULL DEFAULT 'initiated',
	`workflowInstanceId` int,
	`initiatedBy` int NOT NULL,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employeeExits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employeeTransfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`fromDepartmentId` int,
	`toDepartmentId` int,
	`fromLocationId` int,
	`toLocationId` int,
	`fromDesignationId` int,
	`toDesignationId` int,
	`fromReportsToId` int,
	`toReportsToId` int,
	`effectiveDate` timestamp NOT NULL,
	`reason` text,
	`status` enum('draft','pending','approved','rejected','executed') NOT NULL DEFAULT 'draft',
	`workflowInstanceId` int,
	`requestedBy` int NOT NULL,
	`executedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employeeTransfers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employmentHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`eventType` enum('hired','promoted','transferred','designation_change','salary_change','status_change','confirmed','exited') NOT NULL,
	`description` varchar(500),
	`effectiveDate` timestamp NOT NULL,
	`previousValue` json,
	`newValue` json,
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employmentHistory_id` PRIMARY KEY(`id`)
);
