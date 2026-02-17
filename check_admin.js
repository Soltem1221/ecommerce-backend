const db = require('./config/database');
const bcrypt = require('bcryptjs');
const fs = require('fs');

async function checkAdmin() {
    let logContent = '';
    const log = (msg) => {
        console.log(msg);
        logContent += msg + '\n';
    };

    try {
        log('--- Admin Check Start ---');
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', ['sol@gmail.com']);

        if (users.length === 0) {
            log('❌ Error: No user found with email sol@gmail.com');
            const [allUsers] = await db.query('SELECT email, role FROM users');
            log('Registered users: ' + JSON.stringify(allUsers, null, 2));
        } else {
            const user = users[0];
            log('✅ User found: ' + JSON.stringify({ email: user.email, role: user.role, is_active: user.is_active }, null, 2));

            const passwordsToTest = ['1234', 'admin123'];
            for (const pwd of passwordsToTest) {
                const isMatch = await bcrypt.compare(pwd, user.password);
                if (isMatch) {
                    log(`✅ Password "${pwd}" MATCHES the hash in database.`);
                } else {
                    log(`❌ Password "${pwd}" does NOT match.`);
                }
            }

            if (user.password === '1234' || user.password === 'admin123') {
                log('⚠️ Note: The password in DB matches one of our tests as PLAIN TEXT.');
            }
        }
        log('--- Admin Check End ---');
        fs.writeFileSync('admin_check_results.log', logContent);
        process.exit(0);
    } catch (error) {
        fs.writeFileSync('admin_check_results.log', '❌ Database error: ' + error.message);
        process.exit(1);
    }
}

checkAdmin();
