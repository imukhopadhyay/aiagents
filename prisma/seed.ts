// Idempotent seed: safe to run repeatedly. Syncs roles and permissions from
// src/lib/rbac/permissions.ts and creates demo data for local development.

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient, type EmploymentType } from "../src/generated/prisma/client";
import { PERMISSIONS, ROLES, type RoleKey } from "../src/lib/rbac/permissions";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "ChangeMe123!";

async function syncRbac() {
  const permissionIds = new Map<string, string>();
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    const permission = await db.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
    permissionIds.set(key, permission.id);
  }

  const roleIds = new Map<RoleKey, string>();
  for (const [key, definition] of Object.entries(ROLES) as [RoleKey, (typeof ROLES)[RoleKey]][]) {
    const role = await db.role.upsert({
      where: { key },
      update: { name: definition.name, description: definition.description, isSystem: true },
      create: { key, name: definition.name, description: definition.description, isSystem: true },
    });
    roleIds.set(key, role.id);

    // System roles always match the code definition exactly.
    await db.$transaction([
      db.rolePermission.deleteMany({ where: { roleId: role.id } }),
      db.rolePermission.createMany({
        data: Object.entries(definition.grants).map(([permission, scope]) => ({
          roleId: role.id,
          permissionId: permissionIds.get(permission)!,
          scope,
        })),
      }),
    ]);
  }
  return roleIds;
}

async function upsertUser(email: string, name: string | null, password: string) {
  return db.user.upsert({
    where: { email },
    // Never reset an existing user's password on re-seed.
    update: { name },
    create: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 12),
      emailVerified: new Date(),
    },
  });
}

async function assignRoles(userId: string, roles: RoleKey[], roleIds: Map<RoleKey, string>) {
  for (const role of roles) {
    const roleId = roleIds.get(role)!;
    await db.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }
}

interface DemoPerson {
  number: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  position: string;
  location: string;
  manager?: string; // employee number
  roles: RoleKey[];
  hireDate: string;
  employmentType?: EmploymentType;
}

const PEOPLE: DemoPerson[] = [
  {
    number: "E0001",
    firstName: "Alex",
    lastName: "Morgan",
    email: "ceo@example.com",
    department: "EXEC",
    position: "CEO",
    location: "Headquarters",
    roles: ["EMPLOYEE", "MANAGER"],
    hireDate: "2018-01-15",
  },
  {
    number: "E0002",
    firstName: "Hannah",
    lastName: "Lee",
    email: "hr.admin@example.com",
    department: "HR",
    position: "HR-DIR",
    location: "Headquarters",
    manager: "E0001",
    roles: ["EMPLOYEE", "HR_ADMIN"],
    hireDate: "2019-03-01",
  },
  {
    number: "E0003",
    firstName: "Priya",
    lastName: "Patel",
    email: "hr.manager@example.com",
    department: "HR",
    position: "HR-GEN",
    location: "Headquarters",
    manager: "E0002",
    roles: ["EMPLOYEE", "HR_MANAGER"],
    hireDate: "2020-06-15",
  },
  {
    number: "E0004",
    firstName: "Jordan",
    lastName: "Rivera",
    email: "vp.eng@example.com",
    department: "ENG",
    position: "VP-ENG",
    location: "Headquarters",
    manager: "E0001",
    roles: ["EMPLOYEE", "MANAGER"],
    hireDate: "2019-09-01",
  },
  {
    number: "E0005",
    firstName: "Marcus",
    lastName: "Chen",
    email: "manager@example.com",
    department: "ENG-PLAT",
    position: "ENG-MGR",
    location: "London Office",
    manager: "E0004",
    roles: ["EMPLOYEE", "MANAGER"],
    hireDate: "2021-02-01",
  },
  {
    number: "E0006",
    firstName: "Emma",
    lastName: "Wilson",
    email: "employee@example.com",
    department: "ENG-PLAT",
    position: "SWE",
    location: "London Office",
    manager: "E0005",
    roles: ["EMPLOYEE"],
    hireDate: "2022-04-11",
  },
  {
    number: "E0007",
    firstName: "Liam",
    lastName: "Brown",
    email: "liam.brown@example.com",
    department: "ENG-PLAT",
    position: "SWE",
    location: "Headquarters",
    manager: "E0005",
    roles: ["EMPLOYEE"],
    hireDate: "2023-08-21",
  },
  {
    number: "E0008",
    firstName: "Noah",
    lastName: "Davis",
    email: "noah.davis@example.com",
    department: "SALES",
    position: "SALES-REP",
    location: "Headquarters",
    manager: "E0001",
    roles: ["EMPLOYEE"],
    hireDate: "2024-01-08",
    employmentType: "CONTRACT",
  },
];

const DEPARTMENTS = [
  { code: "EXEC", name: "Executive", parent: null, head: "E0001" },
  { code: "HR", name: "People Operations", parent: "EXEC", head: "E0002" },
  { code: "ENG", name: "Engineering", parent: "EXEC", head: "E0004" },
  { code: "ENG-PLAT", name: "Platform Engineering", parent: "ENG", head: "E0005" },
  { code: "SALES", name: "Sales", parent: "EXEC", head: null },
] as const;

const POSITIONS = [
  { code: "CEO", title: "Chief Executive Officer", department: "EXEC", level: 10 },
  { code: "HR-DIR", title: "HR Director", department: "HR", level: 8 },
  { code: "HR-GEN", title: "HR Generalist", department: "HR", level: 4 },
  { code: "VP-ENG", title: "VP of Engineering", department: "ENG", level: 9 },
  { code: "ENG-MGR", title: "Engineering Manager", department: "ENG-PLAT", level: 7 },
  { code: "SWE", title: "Software Engineer", department: "ENG-PLAT", level: 4 },
  { code: "SALES-REP", title: "Account Executive", department: "SALES", level: 4 },
] as const;

async function seedOrganization() {
  const locations = new Map<string, string>();
  for (const loc of [
    { name: "Headquarters", city: "New York", country: "US", timezone: "America/New_York" },
    { name: "London Office", city: "London", country: "GB", timezone: "Europe/London" },
  ]) {
    const { id } = await db.location.upsert({
      where: { name: loc.name },
      update: loc,
      create: loc,
    });
    locations.set(loc.name, id);
  }

  const departments = new Map<string, string>();
  for (const dept of DEPARTMENTS) {
    const { id } = await db.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, parentId: dept.parent ? departments.get(dept.parent) : null },
      create: {
        code: dept.code,
        name: dept.name,
        parentId: dept.parent ? departments.get(dept.parent) : null,
      },
    });
    departments.set(dept.code, id);
  }

  const positions = new Map<string, string>();
  for (const pos of POSITIONS) {
    const data = {
      title: pos.title,
      level: pos.level,
      departmentId: departments.get(pos.department),
    };
    const { id } = await db.position.upsert({
      where: { code: pos.code },
      update: data,
      create: { code: pos.code, ...data },
    });
    positions.set(pos.code, id);
  }

  return { locations, departments, positions };
}

async function seedPeople(
  roleIds: Map<RoleKey, string>,
  org: Awaited<ReturnType<typeof seedOrganization>>,
) {
  const employees = new Map<string, string>();
  for (const person of PEOPLE) {
    const user = await upsertUser(
      person.email,
      `${person.firstName} ${person.lastName}`,
      DEMO_PASSWORD,
    );
    await assignRoles(user.id, person.roles, roleIds);

    const data = {
      userId: user.id,
      firstName: person.firstName,
      lastName: person.lastName,
      workEmail: person.email,
      departmentId: org.departments.get(person.department),
      positionId: org.positions.get(person.position),
      locationId: org.locations.get(person.location),
      employmentType: person.employmentType ?? "FULL_TIME",
      hireDate: new Date(person.hireDate),
    };
    const employee = await db.employee.upsert({
      where: { employeeNumber: person.number },
      update: data,
      create: { employeeNumber: person.number, ...data },
    });
    employees.set(person.number, employee.id);
  }

  // Reporting lines and department heads need every employee to exist first.
  for (const person of PEOPLE) {
    await db.employee.update({
      where: { employeeNumber: person.number },
      data: { managerId: person.manager ? employees.get(person.manager) : null },
    });
  }
  for (const dept of DEPARTMENTS) {
    await db.department.update({
      where: { code: dept.code },
      data: { headId: dept.head ? employees.get(dept.head) : null },
    });
  }
  return employees;
}

async function seedLeave(employees: Map<string, string>) {
  const types = [
    {
      code: "AL",
      name: "Annual Leave",
      annualAllowance: 20,
      maxCarryOver: 5,
      accrualPeriod: "MONTHLY" as const,
    },
    {
      code: "SL",
      name: "Sick Leave",
      annualAllowance: 10,
      maxCarryOver: 0,
      accrualPeriod: "YEARLY" as const,
    },
    {
      code: "PL",
      name: "Parental Leave",
      annualAllowance: 0,
      maxCarryOver: 0,
      accrualPeriod: "NONE" as const,
    },
    {
      code: "UL",
      name: "Unpaid Leave",
      annualAllowance: 0,
      maxCarryOver: 0,
      accrualPeriod: "NONE" as const,
      isPaid: false,
    },
  ];
  const year = new Date().getFullYear();

  for (const type of types) {
    const leaveType = await db.leaveType.upsert({
      where: { code: type.code },
      update: type,
      create: type,
    });
    if (type.annualAllowance === 0) continue;
    for (const employeeId of employees.values()) {
      await db.leaveBalance.upsert({
        where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: leaveType.id, year } },
        update: {},
        create: { employeeId, leaveTypeId: leaveType.id, year, allocated: type.annualAllowance },
      });
    }
  }
}

async function seedRecruitment(
  employees: Map<string, string>,
  org: Awaited<ReturnType<typeof seedOrganization>>,
) {
  const title = "Senior Software Engineer";
  const existing = await db.jobOpening.findFirst({ where: { title, deletedAt: null } });
  const opening =
    existing ??
    (await db.jobOpening.create({
      data: {
        title,
        description: "Build and scale the platform that powers our HR products.",
        requirements: "5+ years of TypeScript; experience with PostgreSQL and React.",
        departmentId: org.departments.get("ENG-PLAT"),
        positionId: org.positions.get("SWE"),
        locationId: org.locations.get("London Office"),
        hiringManagerId: employees.get("E0005"),
        headcount: 2,
        status: "OPEN",
        publishedAt: new Date(),
      },
    }));

  const candidate = await db.candidate.upsert({
    where: { email: "sam.taylor@example.net" },
    update: {},
    create: {
      firstName: "Sam",
      lastName: "Taylor",
      email: "sam.taylor@example.net",
      source: "Referral",
      tags: ["typescript", "postgres"],
    },
  });
  await db.application.upsert({
    where: { candidateId_jobOpeningId: { candidateId: candidate.id, jobOpeningId: opening.id } },
    update: {},
    create: { candidateId: candidate.id, jobOpeningId: opening.id, stage: "SCREENING" },
  });
}

async function main() {
  const roleIds = await syncRbac();

  const admin = await upsertUser(ADMIN_EMAIL, "System Administrator", ADMIN_PASSWORD);
  await assignRoles(admin.id, ["SUPER_ADMIN"], roleIds);

  const org = await seedOrganization();
  const employees = await seedPeople(roleIds, org);
  await seedLeave(employees);
  await seedRecruitment(employees, org);

  console.info(
    `Seeded ${roleIds.size} roles, ${Object.keys(PERMISSIONS).length} permissions, ${employees.size} employees.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
