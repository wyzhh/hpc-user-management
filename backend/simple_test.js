require('dotenv').config();
const pool = require('./dist/config/database.js').default;

async function simpleTest() {
  console.log('=== 简单数据库测试 ===\n');
  
  try {
    // 1. 测试数据库连接
    console.log('1. 测试数据库连接...');
    const connectTest = await pool.query('SELECT NOW()');
    console.log(`   ✅ 数据库连接成功: ${connectTest.rows[0].now}`);
    
    // 2. 测试学生查询
    console.log('\n2. 测试学生查询...');
    const studentQuery = `
      SELECT s.*, u.username, u.full_name, u.email, u.phone
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE u.username = $1
    `;
    const studentResult = await pool.query(studentQuery, ['zyqgroup01']);
    if (studentResult.rows.length > 0) {
      console.log(`   ✅ 找到学生: ${studentResult.rows[0].username}`);
      console.log(`   学生信息:`, {
        full_name: studentResult.rows[0].full_name,
        email: studentResult.rows[0].email,
        phone: studentResult.rows[0].phone,
        major: studentResult.rows[0].major
      });
    } else {
      console.log('   ❌ 未找到学生');
    }
    
    // 3. 测试PI查询
    console.log('\n3. 测试PI查询...');
    const piQuery = `
      SELECT p.*, u.username, u.full_name, u.email, u.phone
      FROM pis p
      JOIN users u ON p.user_id = u.id
      WHERE u.username = $1 AND p.is_active = true
    `;
    const piResult = await pool.query(piQuery, ['ztron']);
    if (piResult.rows.length > 0) {
      console.log(`   ✅ 找到PI: ${piResult.rows[0].username}`);
      console.log(`   PI信息:`, {
        full_name: piResult.rows[0].full_name,
        email: piResult.rows[0].email,
        phone: piResult.rows[0].phone,
        department: piResult.rows[0].department
      });
    } else {
      console.log('   ❌ 未找到PI');
    }
    
    // 4. 测试智能更新逻辑
    console.log('\n4. 测试本地字段检测逻辑...');
    if (studentResult.rows.length > 0) {
      const student = studentResult.rows[0];
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
      
      console.log(`   学生本地修改字段: [${localFields.join(', ')}]`);
    }
    
    if (piResult.rows.length > 0) {
      const pi = piResult.rows[0];
      const localFields = [];
      
      if (pi.full_name && pi.full_name.trim() !== '') {
        localFields.push('full_name');
      }
      if (pi.email && pi.email.trim() !== '' && !pi.email.includes('@ldap.')) {
        localFields.push('email');
      }
      if (pi.phone && pi.phone.trim() !== '') {
        localFields.push('phone');
      }
      if (pi.department && pi.department.trim() !== '') {
        localFields.push('department');
      }
      
      console.log(`   PI本地修改字段: [${localFields.join(', ')}]`);
    }
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    pool.end();
  }
}

simpleTest();