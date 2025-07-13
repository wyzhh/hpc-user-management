// 简单测试脚本，验证家目录路径逻辑
console.log('=== 测试家目录路径逻辑 ===\n');

// 模拟数据
const piHomePaths = [
  '/work/home/ztron',
  '/work/home/ldgroup', 
  '/home/users/testpi',
  '/data/users/another_pi'
];

const studentUsername = 'testuser123';

function getStudentHomeDirectory(piHomePath, studentUsername) {
  // 从PI的home目录提取基础路径
  const basePath = piHomePath.substring(0, piHomePath.lastIndexOf('/'));
  return `${basePath}/${studentUsername}`;
}

console.log('PI目录 → 学生目录映射:');
piHomePaths.forEach(piPath => {
  const studentPath = getStudentHomeDirectory(piPath, studentUsername);
  console.log(`  ${piPath} → ${studentPath}`);
});

console.log('\n具体示例:');
console.log(`PI目录: /work/home/ztron → 学生目录: ${getStudentHomeDirectory('/work/home/ztron', studentUsername)}`);

console.log('\n=== 测试完成 ===');