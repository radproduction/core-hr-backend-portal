CREATE TABLE `aiScreeningConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`jobPostingId` int NOT NULL,
	`mustHaveSkills` json,
	`niceToHaveSkills` json,
	`minExperience` int DEFAULT 0,
	`maxExperience` int,
	`keywords` json,
	`biasCheckEnabled` boolean NOT NULL DEFAULT true,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiScreeningConfigs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `applicationStageHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int NOT NULL,
	`fromStage` varchar(50),
	`toStage` varchar(50) NOT NULL,
	`movedBy` int,
	`movedAt` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	CONSTRAINT `applicationStageHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`jobPostingId` int NOT NULL,
	`candidateId` int NOT NULL,
	`stage` enum('applied','screening','shortlisted','test','interview','evaluation','offer','hired','rejected','withdrawn') NOT NULL DEFAULT 'applied',
	`status` enum('active','on_hold','rejected','withdrawn','hired') NOT NULL DEFAULT 'active',
	`appliedAt` timestamp NOT NULL DEFAULT (now()),
	`coverLetter` text,
	`expectedSalary` decimal(12,2),
	`currency` varchar(10) DEFAULT 'AED',
	`referredBy` int,
	`aiScreeningScore` int,
	`aiScreeningReason` text,
	`aiMatchScore` int,
	`aiMatchReason` text,
	`notes` text,
	`rejectionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `candidateTags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(20) NOT NULL DEFAULT '#6366f1',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `candidateTags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(50),
	`currentTitle` varchar(255),
	`currentCompany` varchar(255),
	`totalExperience` decimal(5,1),
	`skills` json,
	`education` json,
	`resumeUrl` text,
	`resumeKey` varchar(500),
	`linkedinUrl` varchar(500),
	`source` enum('direct','referral','linkedin','job_board','career_portal','agency','other') NOT NULL DEFAULT 'direct',
	`status` enum('active','inactive','blacklisted') NOT NULL DEFAULT 'active',
	`tags` json,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `candidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `careerPortalSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`headline` varchar(500),
	`description` text,
	`logoUrl` text,
	`bannerUrl` text,
	`primaryColor` varchar(20) DEFAULT '#2563eb',
	`isActive` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `careerPortalSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evaluationTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('test','interview','evaluation','technical','behavioral') NOT NULL DEFAULT 'interview',
	`description` text,
	`criteria` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evaluationTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interviewSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`applicationId` int NOT NULL,
	`interviewerId` int NOT NULL,
	`templateId` int,
	`scheduledAt` timestamp NOT NULL,
	`duration` int NOT NULL DEFAULT 60,
	`type` enum('phone','video','in_person','technical','panel') NOT NULL DEFAULT 'video',
	`location` varchar(500),
	`meetingLink` varchar(1000),
	`status` enum('scheduled','completed','cancelled','no_show','rescheduled') NOT NULL DEFAULT 'scheduled',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interviewSchedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interviewScorecards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`interviewScheduleId` int NOT NULL,
	`applicationId` int NOT NULL,
	`interviewerId` int NOT NULL,
	`ratings` json,
	`overallRating` int,
	`recommendation` enum('strong_hire','hire','neutral','no_hire','strong_no_hire'),
	`strengths` text,
	`weaknesses` text,
	`notes` text,
	`aiSummary` text,
	`submittedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interviewScorecards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobPostings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`requisitionId` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`requirements` text,
	`responsibilities` text,
	`location` varchar(255),
	`type` enum('full_time','part_time','contract','internship','freelance') NOT NULL DEFAULT 'full_time',
	`salaryMin` decimal(12,2),
	`salaryMax` decimal(12,2),
	`currency` varchar(10) NOT NULL DEFAULT 'AED',
	`experienceMin` int DEFAULT 0,
	`experienceMax` int,
	`skills` json,
	`isPublic` boolean NOT NULL DEFAULT true,
	`status` enum('draft','published','paused','closed','filled') NOT NULL DEFAULT 'draft',
	`publishedAt` timestamp,
	`closingDate` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobPostings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobRequisitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`departmentId` int,
	`designationId` int,
	`requestedBy` int NOT NULL,
	`approvedBy` int,
	`title` varchar(255) NOT NULL,
	`headcount` int NOT NULL DEFAULT 1,
	`justification` text,
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`status` enum('draft','pending_approval','approved','rejected','fulfilled','cancelled') NOT NULL DEFAULT 'draft',
	`targetDate` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobRequisitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `offerLetters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`applicationId` int NOT NULL,
	`candidateId` int NOT NULL,
	`jobPostingId` int NOT NULL,
	`offeredSalary` decimal(12,2) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'AED',
	`startDate` timestamp,
	`expiryDate` timestamp,
	`status` enum('draft','sent','accepted','rejected','expired','withdrawn') NOT NULL DEFAULT 'draft',
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `offerLetters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recruitmentActivities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`applicationId` int,
	`candidateId` int,
	`jobPostingId` int,
	`actorId` int,
	`action` varchar(100) NOT NULL,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recruitmentActivities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recruitmentEmailTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`trigger` enum('application_received','shortlisted','interview_scheduled','offer_sent','rejected','hired') NOT NULL,
	`subject` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recruitmentEmailTemplates_id` PRIMARY KEY(`id`)
);
