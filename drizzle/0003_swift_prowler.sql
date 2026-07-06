CREATE TABLE `compensatoryLeaves` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`earnedDate` timestamp NOT NULL,
	`reason` text NOT NULL,
	`earnedDays` decimal(5,2) NOT NULL,
	`usedDays` decimal(5,2) NOT NULL DEFAULT '0.00',
	`expiryDate` timestamp,
	`status` enum('active','used','expired','cancelled') NOT NULL DEFAULT 'active',
	`approvedBy` int,
	`linkedLeaveRequestId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `compensatoryLeaves_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leaveAccrualLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`leaveTypeId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`accrualDays` decimal(5,2) NOT NULL,
	`balanceBefore` decimal(6,2) NOT NULL,
	`balanceAfter` decimal(6,2) NOT NULL,
	`notes` text,
	`runAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leaveAccrualLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leaveApprovals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leaveRequestId` int NOT NULL,
	`approverId` int NOT NULL,
	`step` int NOT NULL DEFAULT 1,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`comments` text,
	`aiCoverageSummary` text,
	`decidedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leaveApprovals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leaveBalances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`leaveTypeId` int NOT NULL,
	`year` int NOT NULL,
	`entitled` decimal(6,2) NOT NULL DEFAULT '0.00',
	`used` decimal(6,2) NOT NULL DEFAULT '0.00',
	`pending` decimal(6,2) NOT NULL DEFAULT '0.00',
	`carryForward` decimal(6,2) NOT NULL DEFAULT '0.00',
	`compensatory` decimal(6,2) NOT NULL DEFAULT '0.00',
	`balance` decimal(6,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leaveBalances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leaveCarryForwardLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`leaveTypeId` int NOT NULL,
	`fromYear` int NOT NULL,
	`toYear` int NOT NULL,
	`balanceAtYearEnd` decimal(6,2) NOT NULL,
	`carriedDays` decimal(6,2) NOT NULL,
	`expiredDays` decimal(6,2) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leaveCarryForwardLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leavePolicies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`leaveTypeId` int NOT NULL,
	`applicableTo` enum('all','department','gender','designation') NOT NULL DEFAULT 'all',
	`departmentId` int,
	`designationId` int,
	`gender` enum('all','male','female') NOT NULL DEFAULT 'all',
	`entitlementDays` decimal(5,2) NOT NULL,
	`prorateOnJoining` boolean NOT NULL DEFAULT true,
	`prorateOnExit` boolean NOT NULL DEFAULT true,
	`effectiveFrom` timestamp NOT NULL,
	`effectiveTo` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leavePolicies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leaveRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`leaveTypeId` int NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`days` decimal(5,2) NOT NULL,
	`isHalfDay` boolean NOT NULL DEFAULT false,
	`halfDayPeriod` enum('morning','afternoon'),
	`reason` text NOT NULL,
	`aiDraftUsed` boolean NOT NULL DEFAULT false,
	`attachmentKey` varchar(500),
	`status` enum('pending','approved','rejected','cancelled','withdrawn') NOT NULL DEFAULT 'pending',
	`appliedAt` timestamp NOT NULL DEFAULT (now()),
	`approvedBy` int,
	`approvedAt` timestamp,
	`rejectedReason` text,
	`cancelledAt` timestamp,
	`cancelReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leaveRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leaveTypes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`code` varchar(20) NOT NULL,
	`description` text,
	`isPaid` boolean NOT NULL DEFAULT true,
	`isCarryForward` boolean NOT NULL DEFAULT false,
	`maxCarryDays` int NOT NULL DEFAULT 0,
	`accrualType` enum('none','monthly','yearly','per_period') NOT NULL DEFAULT 'none',
	`accrualRate` decimal(5,2) DEFAULT '0.00',
	`maxBalance` decimal(5,2) DEFAULT '0.00',
	`applicableGender` enum('all','male','female') NOT NULL DEFAULT 'all',
	`requiresApproval` boolean NOT NULL DEFAULT true,
	`requiresDocument` boolean NOT NULL DEFAULT false,
	`minDaysNotice` int NOT NULL DEFAULT 0,
	`maxConsecutiveDays` int NOT NULL DEFAULT 0,
	`colorCode` varchar(10) DEFAULT '#6366f1',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leaveTypes_id` PRIMARY KEY(`id`)
);
