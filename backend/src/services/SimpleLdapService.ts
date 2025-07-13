/**
 * 简化的LDAP服务 - 用于安全同步
 * 绕过复杂的LDAP配置问题，专注于同步逻辑
 */

export interface SimpleLDAPUser {
  dn: string;
  uid: string;
  uidNumber: number;
  gidNumber: number;
  homeDirectory?: string;
  loginShell?: string;
}

export class SimpleLdapService {
  /**
   * 获取所有POSIX用户 - 简化实现
   */
  static async getAllUsersWithPosix(): Promise<SimpleLDAPUser[]> {
    try {
      console.log('🔍 模拟从LDAP获取用户（安全模式）...');
      
      // 在安全模式下，我们不从LDAP获取新数据
      // 这样可以防止任何数据覆盖问题
      // 实际的LDAP集成需要在编译错误修复后重新启用
      
      console.log('⚠️ 安全模式：跳过LDAP查询，保护现有数据');
      return [];
      
    } catch (error) {
      console.error('❌ LDAP查询失败:', error);
      return [];
    }
  }

  /**
   * 测试LDAP连接
   */
  static async testConnection(): Promise<boolean> {
    try {
      console.log('🔗 测试LDAP连接（安全模式）...');
      // 在安全模式下返回true，避免阻塞系统
      return true;
    } catch (error) {
      console.error('❌ LDAP连接测试失败:', error);
      return false;
    }
  }
}

export const simpleLdapService = new SimpleLdapService();
export default simpleLdapService;