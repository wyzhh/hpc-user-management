# OpenSCOW 数据库架构分析

## 📋 概述

OpenSCOW (Super Computing on the Web) 是一个开源的HPC管理系统，使用TypeScript + MikroORM架构。相比我们的项目，OpenSCOW有更复杂的多租户、计费和资源管理功能。

## 🏗️ 核心架构对比

### OpenSCOW vs 我们的HPC用户管理系统

| 特性 | OpenSCOW | 我们的系统 |
|------|----------|------------|
| **架构** | MikroORM + TypeScript | PostgreSQL + 自定义模型 |
| **用户模型** | 多租户 + 账户 + 用户三层架构 | PI + 学生 + 管理员三角色 |
| **认证** | 多种认证方式 | LDAP + 本地认证 |
| **计费** | 完整的计费和账单系统 | 简单的用户管理 |
| **作业管理** | 详细的作业追踪和计费 | 无作业管理 |
| **权限** | 复杂的角色和权限系统 | 基于角色的简单权限 |

## 📊 OpenSCOW 数据库实体分析

### 1. 核心用户管理架构

#### A. 三层用户架构
```
Tenant (租户)
  ├── Account (账户) 
  │   └── UserAccount (用户-账户关联)
  └── User (用户)
```

#### B. 实体关系图
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Tenant    │───▶│   Account   │◀──▶│    User     │
│             │    │             │    │             │
│- name       │    │- accountName│    │- userId     │
│- balance    │    │- balance    │    │- name       │
│- createTime │    │- state      │    │- email      │
└─────────────┘    │- comment    │    │- roles      │
                   └─────────────┘    └─────────────┘
                           │                  │
                           └──────────────────┘
                                     │
                               ┌─────────────┐
                               │UserAccount  │
                               │             │
                               │- role       │
                               │- status     │
                               │- limits     │
                               └─────────────┘
```

### 2. 详细实体分析

#### **Tenant (租户)**
```typescript
@Entity()
export class Tenant {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  name: string;                    // 租户名称

  @Property({ type: DecimalType })
  balance: Decimal;                // 租户余额

  @Property({ type: DecimalType })
  defaultAccountBlockThreshold: Decimal;  // 默认账户封锁阈值

  @Property({ columnType: DATETIME_TYPE })
  createTime: Date;                // 创建时间
}
```

**特点:**
- 多租户架构的顶层实体
- 每个租户有独立的余额管理
- 支持设置账户封锁阈值

#### **Account (账户)**
```typescript
@Entity()
export class Account {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  accountName: string;              // 账户名

  @ManyToOne(() => Tenant)
  tenant: Ref<Tenant>;             // 所属租户

  @Property()
  blockedInCluster: boolean;       // 在集群中是否被封锁

  @Property({ type: DecimalType })
  balance: Decimal;                // 账户余额

  @Property({ type: DecimalType })
  blockThresholdAmount: Decimal;   // 封锁阈值

  @Enum(() => AccountState)
  state: AccountState;             // 账户状态 (NORMAL/FROZEN/BLOCKED_BY_ADMIN)

  @OneToOne(() => AccountWhitelist)
  whitelist?: Ref<AccountWhitelist>; // 白名单关联
}

enum AccountState {
  NORMAL = "NORMAL",
  FROZEN = "FROZEN", 
  BLOCKED_BY_ADMIN = "BLOCKED_BY_ADMIN"
}
```

**特点:**
- 账户是计费和资源分配的基本单位
- 支持余额管理和自动封锁
- 可设置白名单
- 多种账户状态管理

#### **User (用户)**
```typescript
@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Tenant)
  tenant: Ref<Tenant>;             // 所属租户

  @Property({ unique: true })
  userId: string;                  // 用户ID

  @Property()
  name: string;                    // 用户名

  @Property()
  email: string;                   // 邮箱

  @Enum({ array: true })
  tenantRoles: TenantRole[];       // 租户级角色

  @Enum({ array: true })
  platformRoles: PlatformRole[];   // 平台级角色
}

enum TenantRole {
  TENANT_FINANCE = "TENANT_FINANCE",
  TENANT_ADMIN = "TENANT_ADMIN"
}

enum PlatformRole {
  PLATFORM_FINANCE = "PLATFORM_FINANCE", 
  PLATFORM_ADMIN = "PLATFORM_ADMIN"
}
```

**特点:**
- 用户属于特定租户
- 支持多级角色系统（租户级 + 平台级）
- 角色数组支持一个用户多个角色

#### **UserAccount (用户-账户关联)**
```typescript
@Entity()
export class UserAccount {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => User)
  user: Ref<User>;                 // 关联用户

  @ManyToOne(() => Account)
  account: Ref<Account>;           // 关联账户

  @Property()
  blockedInCluster: UserStatus;    // 在集群中的状态

  @Property()
  role: UserRole;                  // 在账户中的角色

  @Property({ type: DecimalType })
  usedJobCharge?: Decimal;         // 已使用的作业费用

  @Property({ type: DecimalType })
  jobChargeLimit?: Decimal;        // 作业费用限制

  @Enum()
  state: UserStateInAccount;       // 在账户中的状态
}

enum UserStatus {
  UNBLOCKED = "UNBLOCKED",
  BLOCKED = "BLOCKED"
}

enum UserRole {
  USER = "USER",
  ADMIN = "ADMIN", 
  OWNER = "OWNER"
}

enum UserStateInAccount {
  NORMAL = "NORMAL",
  BLOCKED_BY_ADMIN = "BLOCKED_BY_ADMIN"
}
```

**特点:**
- 多对多关系的中间表，用户可以属于多个账户
- 每个用户在不同账户中可以有不同角色
- 支持作业费用限制和追踪
- 细粒度的状态管理

### 3. 作业管理系统

#### **JobInfo (作业信息)**
```typescript
@Entity()
export class JobInfo {
  @PrimaryKey()
  biJobIndex!: number;             // 主键索引

  @Property()
  idJob!: number;                  // 作业ID

  @Property()
  account!: string;                // 账户名

  @Property()
  user!: string;                   // 用户名

  @Property()
  cluster!: string;                // 集群名

  @Property()
  timeSubmit!: Date;               // 提交时间
  
  @Property()
  timeStart!: Date;                // 开始时间
  
  @Property()
  timeEnd!: Date;                  // 结束时间

  // 资源信息
  @Property()
  cpusReq!: number;                // 申请CPU数
  
  @Property()
  memReq!: number;                 // 申请内存(MB)
  
  @Property()
  nodesReq!: number;               // 申请节点数
  
  @Property()
  gpu!: number;                    // 使用GPU数

  // 计费信息
  @Property({ type: DecimalType })
  tenantPrice: Decimal;            // 租户价格
  
  @Property({ type: DecimalType })
  accountPrice: Decimal;           // 账户价格

  @Property()
  tenantBillingItemId: string;     // 租户计费项ID
  
  @Property()
  accountBillingItemId: string;    // 账户计费项ID
}
```

**特点:**
- 详细的作业资源记录
- 双重计费（租户级 + 账户级）
- 丰富的时间统计（提交、开始、结束、等待、使用时间）
- 支持GPU资源追踪

### 4. 计费系统

#### **ChargeRecord (计费记录)**
```sql
CREATE TABLE charge_record (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  time DATETIME NOT NULL,
  tenant_name VARCHAR(255) NOT NULL,
  account_name VARCHAR(255) NULL,
  type VARCHAR(255) NOT NULL,
  amount DECIMAL(19,4) NOT NULL,
  comment VARCHAR(255) NOT NULL
);
```

#### **PayRecord (付款记录)**
```sql  
CREATE TABLE pay_record (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  time DATETIME(6) NOT NULL,
  tenant_name VARCHAR(255) NOT NULL,
  account_name VARCHAR(255) NULL,
  type VARCHAR(255) NOT NULL,
  amount DECIMAL(19,4) NOT NULL,
  operator_id VARCHAR(255) NOT NULL,
  ip_address VARCHAR(255) NOT NULL,
  comment VARCHAR(255) NOT NULL
);
```

**特点:**
- 完整的财务记录追踪
- 操作员和IP地址记录
- 支持租户级和账户级付款

## 🔄 与我们系统的对比分析

### 1. **架构复杂度**

**OpenSCOW:**
- 多租户架构，适合服务提供商
- 复杂的用户-账户-租户关系
- 完整的计费和财务管理

**我们的系统:**
- 单一机构架构，适合高校内部
- 简单的PI-学生-管理员关系
- 专注于用户管理和申请流程

### 2. **用户管理方式**

**OpenSCOW:**
```
用户 → 可以属于多个账户 → 每个账户有不同角色 → 账户属于租户
```

**我们的系统:**
```
PI用户 ← 管理 → 学生用户
        ↑
    管理员监督
```

### 3. **权限设计**

**OpenSCOW:**
- 平台级权限 (PLATFORM_ADMIN, PLATFORM_FINANCE)
- 租户级权限 (TENANT_ADMIN, TENANT_FINANCE)  
- 账户级权限 (OWNER, ADMIN, USER)
- 集群级状态 (BLOCKED, UNBLOCKED)

**我们的系统:**
- 角色级权限 (super_admin, admin, pi, student)
- 状态管理 (active, inactive, pending, deleted)

### 4. **数据库技术选择**

**OpenSCOW:**
- MikroORM (TypeScript ORM)
- 实体驱动设计
- 自动迁移管理
- 装饰器语法

**我们的系统:**
- 原生PostgreSQL
- SQL优先设计
- 手动迁移管理
- 直接SQL查询

## 💡 可借鉴的设计思路

### 1. **实体设计模式**
OpenSCOW的实体设计很规范：
- 使用TypeScript装饰器
- 清晰的关系定义
- 枚举类型使用
- 完整的构造函数

### 2. **多对多关系处理**
UserAccount作为中间表的设计：
- 不仅存储关系，还存储关系属性
- 支持同一用户在不同账户的不同角色
- 细粒度的状态管理

### 3. **计费系统架构**
- 双重计费设计（租户级 + 账户级）
- 详细的操作审计
- 金额使用Decimal类型避免精度问题

### 4. **索引设计**
JobInfo表的索引设计很全面：
- 时间字段索引（提交、开始、结束时间）
- 用户和账户索引
- 资源使用时间索引

## 🚀 改进建议

基于OpenSCOW的设计，我们的系统可以考虑：

### 1. **数据库设计改进**
- 引入枚举类型替换字符串状态
- 添加更多索引优化查询性能
- 考虑使用ORM简化数据库操作

### 2. **权限系统升级**
- 实现更细粒度的权限控制
- 支持角色组合和继承
- 添加操作级权限控制

### 3. **审计系统增强**
- 记录操作IP地址
- 添加操作详情JSON字段
- 实现操作回滚功能

### 4. **扩展性考虑**
- 为将来可能的多机构支持预留设计空间
- 考虑计费功能的扩展可能
- 设计插件化的认证系统

## 📚 总结

OpenSCOW展现了一个成熟的HPC管理系统应该具备的复杂性和完整性。虽然我们的系统目前专注于高校内部的用户管理，但OpenSCOW的架构设计给我们提供了很多值得学习的地方，特别是在数据库设计、权限管理和系统扩展性方面。

---

*分析基于OpenSCOW开源代码，版本信息可能随项目更新而变化*