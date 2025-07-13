import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface LdapServerConfig {
  url: string;
  bind_dn: string;
  bind_password: string;
  base_dn: string;
  timeout: number;
  connect_timeout: number;
  idle_timeout: number;
}

export interface LdapOUConfig {
  users: string;
  groups: string;
  legacy: {
    pi_ou: string;
    student_ou: string;
  };
}

export interface LdapFiltersConfig {
  user_base: string;
  group_base: string;
  user_by_username: string;
  users_by_group: string;
  user_search: string;
  custom: {
    active_users: string;
    admin_users: string;
  };
}

export interface LdapAttributesConfig {
  user: {
    username: string;
    user_id: string;
    group_id: string;
    home_directory: string;
  };
  group: {
    name: string;
    group_id: string;
    members: string;
  };
}

export interface LdapQueryAttributesConfig {
  basic_user: string[];
  detailed_user: string[];
  group: string[];
}

export interface LdapAuthConfig {
  user_dn_templates: string[];
  strategy: {
    search_before_bind: boolean;
    check_account_status: boolean;
    cache_duration: number;
  };
}

export interface LdapRoleMappingConfig {
  admin: {
    group_mappings: Array<{
      ldap_group: string;
      system_role: string;
    }>;
    user_mappings: Array<{
      username: string;
      system_role: string;
    }>;
  };
  pi: {
    group_mappings: Array<{
      ldap_group: string;
      system_role: string;
    }>;
  };
}

export interface LdapSyncConfig {
  scope: {
    user_ous: string[];
    group_ous: string[];
    exclude_users: string;
    exclude_groups: string;
  };
  strategy: {
    auto_create_users: boolean;
    auto_update_users: boolean;
    auto_disable_missing_users: boolean;
    sync_groups: boolean;
    batch_size: number;
  };
}

export interface LdapConfig {
  server: LdapServerConfig;
  organizational_units: LdapOUConfig;
  filters: LdapFiltersConfig;
  attributes: LdapAttributesConfig;
  query_attributes: LdapQueryAttributesConfig;
  authentication: LdapAuthConfig;
  role_mapping: LdapRoleMappingConfig;
  synchronization: LdapSyncConfig;
  logging: {
    enabled: boolean;
    level: string;
    log_queries: boolean;
    log_auth_attempts: boolean;
    log_sync_operations: boolean;
  };
  performance: {
    connection_pool: {
      max_connections: number;
      connection_timeout: number;
      idle_timeout: number;
    };
    query_optimization: {
      enable_cache: boolean;
      cache_ttl: number;
      max_cache_entries: number;
      use_paging: boolean;
      page_size: number;
    };
  };
  security: {
    tls: {
      enabled: boolean;
      verification: string;
      ca_cert_path: string;
      client_cert_path: string;
      client_key_path: string;
    };
    password_policy: {
      log_failed_attempts: boolean;
      enable_account_lockout: boolean;
      max_failed_attempts: number;
      lockout_duration: number;
    };
  };
  failover: {
    backup_servers: Array<{
      url: string;
      bind_dn: string;
      bind_password: string;
    }>;
    strategy: {
      auto_failover: boolean;
      health_check_interval: number;
      failure_threshold: number;
      recovery_check_interval: number;
    };
  };
  debug: {
    enabled: boolean;
    log_directory: string;
    ldap_debug: boolean;
    test_users: Array<{
      username: string;
      expected_dn: string;
    }>;
  };
}

export class LdapConfigService {
  private static instance: LdapConfigService;
  private config: LdapConfig | null = null;
  private configPath: string;
  private lastLoadTime: number = 0;
  private readonly CACHE_TTL = 60000; // 1分钟缓存

  constructor(configPath?: string) {
    // 优先使用传入的路径，其次是环境变量，最后是默认路径
    this.configPath = configPath || 
                     process.env.LDAP_CONFIG_PATH || 
                     path.join(__dirname, '../../config/ldap.yaml');
  }

  static getInstance(configPath?: string): LdapConfigService {
    if (!LdapConfigService.instance) {
      LdapConfigService.instance = new LdapConfigService(configPath);
    }
    return LdapConfigService.instance;
  }

  // 加载LDAP配置
  async loadConfig(forceReload = false): Promise<LdapConfig> {
    const now = Date.now();
    
    // 检查缓存
    if (!forceReload && this.config && (now - this.lastLoadTime) < this.CACHE_TTL) {
      return this.config;
    }

    try {
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`LDAP配置文件不存在: ${this.configPath}`);
      }

      const configContent = fs.readFileSync(this.configPath, 'utf8');
      const config = yaml.load(configContent) as LdapConfig;
      
      if (!config) {
        throw new Error('LDAP配置文件为空或格式错误');
      }

      // 验证必要的配置项
      this.validateConfig(config);
      
      this.config = config;
      this.lastLoadTime = now;
      
      if (config.logging.enabled) {
        console.log('LDAP配置加载成功:', {
          server: config.server.url,
          base_dn: config.server.base_dn,
          user_ou: config.organizational_units.users,
        });
      }
      
      return config;

    } catch (error) {
      console.error('加载LDAP配置失败:', error);
      throw error;
    }
  }

  // 验证配置格式
  private validateConfig(config: LdapConfig): void {
    if (!config.server || !config.server.url || !config.server.base_dn) {
      throw new Error('LDAP服务器配置不完整');
    }

    if (!config.organizational_units || !config.organizational_units.users) {
      throw new Error('LDAP组织单元配置不完整');
    }

    if (!config.filters) {
      throw new Error('LDAP过滤器配置不完整');
    }

    if (!config.attributes || !config.attributes.user) {
      throw new Error('LDAP属性映射配置不完整');
    }

    if (!config.authentication || !config.authentication.user_dn_templates) {
      throw new Error('LDAP认证配置不完整');
    }
  }

  // 获取服务器配置
  getServerConfig(): LdapServerConfig {
    if (!this.config) {
      throw new Error('LDAP配置未加载');
    }
    return this.config.server;
  }

  // 获取组织单元配置
  getOUConfig(): LdapOUConfig {
    if (!this.config) {
      throw new Error('LDAP配置未加载');
    }
    return this.config.organizational_units;
  }

  // 获取过滤器配置
  getFiltersConfig(): LdapFiltersConfig {
    if (!this.config) {
      throw new Error('LDAP配置未加载');
    }
    return this.config.filters;
  }

  // 获取属性映射配置
  getAttributesConfig(): LdapAttributesConfig {
    if (!this.config) {
      throw new Error('LDAP配置未加载');
    }
    return this.config.attributes;
  }

  // 获取查询属性配置
  getQueryAttributesConfig(): LdapQueryAttributesConfig {
    if (!this.config) {
      throw new Error('LDAP配置未加载');
    }
    return this.config.query_attributes;
  }

  // 获取认证配置
  getAuthConfig(): LdapAuthConfig {
    if (!this.config) {
      throw new Error('LDAP配置未加载');
    }
    return this.config.authentication;
  }

  // 获取角色映射配置
  getRoleMappingConfig(): LdapRoleMappingConfig {
    if (!this.config) {
      throw new Error('LDAP配置未加载');
    }
    return this.config.role_mapping;
  }

  // 获取同步配置
  getSyncConfig(): LdapSyncConfig {
    if (!this.config) {
      throw new Error('LDAP配置未加载');
    }
    return this.config.synchronization;
  }

  // 构造用户DN
  buildUserDN(username: string): string[] {
    const authConfig = this.getAuthConfig();
    return authConfig.user_dn_templates.map(template => 
      template.replace('{username}', username)
    );
  }

  // 构造过滤器
  buildFilter(filterType: string, params: Record<string, any> = {}): string {
    const filters = this.getFiltersConfig();
    
    let filter: string;
    switch (filterType) {
      case 'user_base':
        filter = filters.user_base;
        break;
      case 'group_base':
        filter = filters.group_base;
        break;
      case 'user_by_username':
        filter = filters.user_by_username;
        break;
      case 'users_by_group':
        filter = filters.users_by_group;
        break;
      case 'user_search':
        filter = filters.user_search;
        break;
      case 'active_users':
        filter = filters.custom.active_users;
        break;
      case 'admin_users':
        filter = filters.custom.admin_users;
        break;
      default:
        throw new Error(`未知的过滤器类型: ${filterType}`);
    }

    // 替换参数
    Object.keys(params).forEach(key => {
      filter = filter.replace(`{${key}}`, params[key]);
    });

    return filter;
  }

  // 获取查询属性列表
  getQueryAttributes(type: 'basic_user' | 'detailed_user' | 'group'): string[] {
    const queryConfig = this.getQueryAttributesConfig();
    return queryConfig[type] || [];
  }

  // 映射LDAP属性到系统属性
  mapLdapUser(ldapAttrs: Record<string, any>): Record<string, any> {
    const attrConfig = this.getAttributesConfig().user;
    
    const mappedUser: Record<string, any> = {};
    
    // 基本映射
    Object.keys(attrConfig).forEach(systemAttr => {
      const ldapAttr = attrConfig[systemAttr as keyof typeof attrConfig];
      if (ldapAttrs[ldapAttr]) {
        mappedUser[systemAttr] = ldapAttrs[ldapAttr];
      }
    });

    return mappedUser;
  }

  // 检查用户角色映射
  checkUserRole(username: string, userGroups: string[] = []): string | null {
    const roleConfig = this.getRoleMappingConfig();

    // 检查用户特定映射
    for (const userMapping of roleConfig.admin.user_mappings) {
      if (userMapping.username === username) {
        return userMapping.system_role;
      }
    }

    // 检查管理员组映射
    for (const groupMapping of roleConfig.admin.group_mappings) {
      if (userGroups.includes(groupMapping.ldap_group)) {
        return groupMapping.system_role;
      }
    }

    // 检查PI组映射
    for (const groupMapping of roleConfig.pi.group_mappings) {
      if (userGroups.includes(groupMapping.ldap_group)) {
        return groupMapping.system_role;
      }
    }

    return null;
  }

  // 重新加载配置
  async reloadConfig(): Promise<LdapConfig> {
    this.config = null;
    this.lastLoadTime = 0;
    console.log('LDAP配置缓存已清除，重新加载...');
    return await this.loadConfig(true);
  }

  // 验证配置文件语法
  async validateConfigFile(): Promise<{ 
    isValid: boolean; 
    errors: string[]; 
    warnings: string[] 
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!fs.existsSync(this.configPath)) {
        errors.push(`配置文件不存在: ${this.configPath}`);
        return { isValid: false, errors, warnings };
      }

      const configContent = fs.readFileSync(this.configPath, 'utf8');
      const config = yaml.load(configContent) as any;

      if (!config) {
        errors.push('配置文件为空或格式错误');
        return { isValid: false, errors, warnings };
      }

      // 验证必要的配置节
      const requiredSections = [
        'server', 'organizational_units', 'filters', 
        'attributes', 'authentication'
      ];

      requiredSections.forEach(section => {
        if (!config[section]) {
          errors.push(`缺少必要的配置节: ${section}`);
        }
      });

      // 验证服务器配置
      if (config.server) {
        if (!config.server.url) {
          errors.push('server.url 配置不能为空');
        }
        if (!config.server.base_dn) {
          errors.push('server.base_dn 配置不能为空');
        }
        if (!config.server.bind_dn) {
          warnings.push('server.bind_dn 未配置，可能影响用户查询功能');
        }
      }

      // 验证认证配置
      if (config.authentication) {
        if (!config.authentication.user_dn_templates || 
            !Array.isArray(config.authentication.user_dn_templates) ||
            config.authentication.user_dn_templates.length === 0) {
          errors.push('authentication.user_dn_templates 必须是非空数组');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      errors.push(`解析配置文件失败: ${error}`);
      return { isValid: false, errors, warnings };
    }
  }

  // 测试连接配置
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      const config = await this.loadConfig();
      
      // 这里可以添加实际的LDAP连接测试逻辑
      // 暂时返回配置验证结果
      const validation = await this.validateConfigFile();
      
      if (!validation.isValid) {
        return {
          success: false,
          message: '配置文件验证失败',
          details: validation.errors
        };
      }

      return {
        success: true,
        message: 'LDAP配置验证成功',
        details: {
          server: config.server.url,
          base_dn: config.server.base_dn,
          user_ou: config.organizational_units.users
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `LDAP配置测试失败: ${error}`,
      };
    }
  }
}

// 导出单例实例
export const ldapConfigService = LdapConfigService.getInstance();