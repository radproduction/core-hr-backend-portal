CREATE TABLE `disbursementCycles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`dayOfMonth` int NOT NULL DEFAULT 25,
	`bankName` varchar(100),
	`accountFormat` varchar(50) NOT NULL DEFAULT 'IBAN',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `disbursementCycles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employeeSalaryAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`structureId` int NOT NULL,
	`basicSalary` decimal(12,2) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'AED',
	`effectiveDate` timestamp NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employeeSalaryAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`loanType` varchar(80) NOT NULL DEFAULT 'Personal Loan',
	`principalAmount` decimal(12,2) NOT NULL,
	`interestRate` decimal(6,4) NOT NULL DEFAULT '0.0000',
	`totalInstallments` int NOT NULL,
	`remainingInstallments` int NOT NULL,
	`monthlyDeduction` decimal(12,2) NOT NULL,
	`disbursedDate` timestamp NOT NULL,
	`status` enum('pending','active','completed','cancelled') NOT NULL DEFAULT 'pending',
	`approvedBy` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payrollAnomalyFlags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payrollRunId` int NOT NULL,
	`employeeId` int NOT NULL,
	`type` enum('salary_spike','salary_drop','duplicate_payment','deduction_error','missing_component','new_employee_high_salary','zero_net') NOT NULL,
	`severity` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`description` text NOT NULL,
	`previousValue` decimal(12,2),
	`currentValue` decimal(12,2),
	`percentChange` decimal(8,2),
	`status` enum('pending','acknowledged','dismissed') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payrollAnomalyFlags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payrollRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'AED',
	`scope` enum('all','department','location','individual') NOT NULL DEFAULT 'all',
	`scopeIds` json DEFAULT ('[]'),
	`status` enum('draft','processing','pending_approval','approved','disbursed','locked') NOT NULL DEFAULT 'draft',
	`runBy` int NOT NULL,
	`approvedBy` int,
	`approvedAt` timestamp,
	`lockedAt` timestamp,
	`totalGross` decimal(14,2) NOT NULL DEFAULT '0.00',
	`totalDeductions` decimal(14,2) NOT NULL DEFAULT '0.00',
	`totalNet` decimal(14,2) NOT NULL DEFAULT '0.00',
	`employeeCount` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payrollRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payslips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payrollRunId` int NOT NULL,
	`employeeId` int NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`basicSalary` decimal(12,2) NOT NULL,
	`grossSalary` decimal(12,2) NOT NULL,
	`totalEarnings` decimal(12,2) NOT NULL,
	`totalDeductions` decimal(12,2) NOT NULL,
	`taxAmount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`pfEmployee` decimal(12,2) NOT NULL DEFAULT '0.00',
	`pfEmployer` decimal(12,2) NOT NULL DEFAULT '0.00',
	`loanDeductions` decimal(12,2) NOT NULL DEFAULT '0.00',
	`advanceDeductions` decimal(12,2) NOT NULL DEFAULT '0.00',
	`lateDeductions` decimal(12,2) NOT NULL DEFAULT '0.00',
	`absentDeductions` decimal(12,2) NOT NULL DEFAULT '0.00',
	`netSalary` decimal(12,2) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'AED',
	`attendanceDays` int NOT NULL DEFAULT 0,
	`absentDays` int NOT NULL DEFAULT 0,
	`components` json DEFAULT ('[]'),
	`status` enum('draft','approved','disbursed') NOT NULL DEFAULT 'draft',
	`pdfKey` varchar(300),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payslips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pfSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeRate` decimal(6,4) NOT NULL DEFAULT '0.0000',
	`employerRate` decimal(6,4) NOT NULL DEFAULT '0.0000',
	`ceiling` decimal(12,2),
	`isActive` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pfSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salaryAdvances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeId` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`requestedDate` timestamp NOT NULL DEFAULT (now()),
	`approvedDate` timestamp,
	`deductionMonth` int,
	`deductionYear` int,
	`status` enum('pending','approved','rejected','deducted') NOT NULL DEFAULT 'pending',
	`approvedBy` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salaryAdvances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salaryComponents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(150) NOT NULL,
	`code` varchar(30) NOT NULL,
	`type` enum('earning','deduction','tax','pf') NOT NULL,
	`calculationType` enum('fixed','percentage_of_basic','percentage_of_gross','formula') NOT NULL DEFAULT 'fixed',
	`value` decimal(12,4) NOT NULL DEFAULT '0.0000',
	`isTaxable` boolean NOT NULL DEFAULT false,
	`isPFApplicable` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salaryComponents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salaryStructureComponents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`structureId` int NOT NULL,
	`componentId` int NOT NULL,
	`overrideValue` decimal(12,4),
	`isActive` boolean NOT NULL DEFAULT true,
	CONSTRAINT `salaryStructureComponents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salaryStructures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(150) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'AED',
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salaryStructures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taxSlabs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`country` varchar(10) NOT NULL DEFAULT 'AE',
	`year` int NOT NULL,
	`fromAmount` decimal(14,2) NOT NULL,
	`toAmount` decimal(14,2),
	`rate` decimal(6,4) NOT NULL DEFAULT '0.0000',
	`fixedAmount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`description` varchar(200),
	CONSTRAINT `taxSlabs_id` PRIMARY KEY(`id`)
);
