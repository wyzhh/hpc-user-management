require('dotenv').config();
const pool = require('./dist/config/database.js').default;

// 简化版的智能更新函数
async function smartUpdateStudent(username, ldapData, localSourceFields = []) {
  try {
    // 获取user_id
    const userQuery = 'SELECT id FROM users WHERE username = $1';
    const userResult = await pool.query(userQuery, [username]);
    if (userResult.rows.length === 0) {
      return null;
    }
    const userId = userResult.rows[0].id;

    // 分别处理users表和students表的字段更新
    const userFields = ['full_name', 'email', 'phone', 'ldap_dn'];
    const studentFields = ['pi_id', 'status', 'major'];
    
    const userUpdates = [];
    const userValues = [];
    const studentUpdates = [];
    const studentValues = [];

    // 处理users表字段
    for (const field of userFields) {
      if (ldapData[field] !== undefined && !localSourceFields.includes(field)) {
        userUpdates.push(`${field} = $${userValues.length + 2}`);
        userValues.push(ldapData[field]);
      }
    }

    // 处理students表字段
    for (const field of studentFields) {
      if (ldapData[field] !== undefined && !localSourceFields.includes(field)) {
        studentUpdates.push(`${field} = $${studentValues.length + 2}`);
        studentValues.push(ldapData[field]);
      }
    }

    // 更新users表
    if (userUpdates.length > 0) {
      const userUpdateQuery = `
        UPDATE users 
        SET ${userUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `;
      await pool.query(userUpdateQuery, [userId, ...userValues]);
    }

    // 更新students表
    if (studentUpdates.length > 0) {
      const studentUpdateQuery = `
        UPDATE students 
        SET ${studentUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = $1
      `;
      await pool.query(studentUpdateQuery, [userId, ...studentValues]);
    }

    // 返回更新后的学生信息
    const resultQuery = `
      SELECT s.*, u.username, u.full_name, u.email, u.phone, u.ldap_dn
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE u.username = $1
    `;
    const result = await pool.query(resultQuery, [username]);
    return result.rows[0] || null;

  } catch (error) {
    console.error('智能更新学生信息失败:', error);
    return null;
  }
}

async function getLocallyModifiedFields(username) {
  const query = `
    SELECT s.*, u.username, u.full_name, u.email, u.phone
    FROM students s
    JOIN users u ON s.user_id = u.id
    WHERE u.username = $1
  `;
  const result = await pool.query(query, [username]);
  const student = result.rows[0];
  
  if (!student) return [];
  
  const localFields = [];
  
  if (student.full_name && student.full_name.trim() !== '') {
    localFields.push('full_name');
  }
  if (student.email && student.email.trim() !== '' && !student.email.includes('@ldap.')) {
    localFields.push('email');
  }
  if (student.phone && student.phone.trim() !== '') {
    localFields.push('phone');
  }
  if (student.major && student.major.trim() !== '') {
    localFields.push('major');
  }
  
  return localFields;
}

async function testSmartUpdate() {
  console.log('=== 测试智能更新功能 ===\n');
  
  try {
    const username = 'zyqgroup01';
    
    // 1. 显示当前数据
    console.log('1. 当前学生数据:');
    const currentQuery = `
      SELECT s.*, u.username, u.full_name, u.email, u.phone
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE u.username = $1
    `;
    const currentResult = await pool.query(currentQuery, [username]);
    const currentStudent = currentResult.rows[0];
    console.log('   当前数据:', {
      username: currentStudent.username,
      full_name: currentStudent.full_name,
      email: currentStudent.email,
      phone: currentStudent.phone,
      major: currentStudent.major
    });
    
    // 2. 检测本地修改字段
    console.log('\n2. 检测本地修改字段...');
    const localFields = await getLocallyModifiedFields(username);
    console.log(`   本地修改字段: [${localFields.join(', ')}]`);
    
    // 3. 模拟LDAP同步数据（尝试覆盖所有字段）
    console.log('\n3. 执行智能更新...');
    const ldapData = {
      full_name: '来自LDAP的新名字',
      email: 'ldap@example.com',
      phone: '18888888888',
      major: '来自LDAP的专业'
    };
    console.log('   LDAP数据:', ldapData);
    console.log(`   保护字段: [${localFields.join(', ')}]`);
    
    const updateResult = await smartUpdateStudent(username, ldapData, localFields);
    
    if (updateResult) {
      console.log('   ✅ 智能更新成功');
      console.log('   更新后数据:', {
        username: updateResult.username,
        full_name: updateResult.full_name,
        email: updateResult.email,
        phone: updateResult.phone,
        major: updateResult.major
      });
      
      // 验证保护是否有效
      const protected = localFields.every(field => {
        return currentStudent[field] === updateResult[field];
      });
      console.log(`   🛡️ 本地字段保护: ${protected ? '有效' : '失败'}`);
      
    } else {
      console.log('   ❌ 智能更新失败');
    }
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    pool.end();
  }
}

testSmartUpdate();