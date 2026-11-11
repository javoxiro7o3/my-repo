import { beforeEach, describe, expect, it } from 'vitest'
import { SHELL_TASKS, VShell } from '@shared/vshell'
import { expandField, nextRuns } from '@shared/cron'

let sh: VShell
beforeEach(() => { sh = new VShell() })
const run = (line: string) => sh.run(line)
const out = (line: string) => run(line).out

describe('navigatsiya va fayllar', () => {
  it('pwd, cd va ~', () => {
    expect(out('pwd').trim()).toBe('/home/talaba')
    run('cd loyiha'); expect(out('pwd').trim()).toBe('/home/talaba/loyiha')
    run('cd ..'); run('cd /etc'); expect(out('pwd').trim()).toBe('/etc')
    run('cd ~'); expect(out('pwd').trim()).toBe('/home/talaba')
    expect(run('cd /yoq').err).toMatch(/Bunday fayl yoki katalog yo'q/)
  })
  it('ls -la uzun format va yashirin fayllar', () => {
    const o = out('ls -la')
    expect(o).toMatch(/\.bashrc/); expect(o).toMatch(/^[-d]rw/m); expect(o).toMatch(/talaba/)
    expect(out('ls')).not.toMatch(/\.bashrc/)
  })
  it('mkdir -p, touch, rm -r, cp, mv', () => {
    run('mkdir -p a/b/c'); expect(sh.node('/home/talaba/a/b/c')?.type).toBe('dir')
    expect(run('mkdir a/b/c').err).toMatch(/mavjud|Fayl mavjud/)
    run('touch a/x.txt'); expect(sh.node('/home/talaba/a/x.txt')).toBeTruthy()
    run('cp a/x.txt a/y.txt'); expect(sh.node('/home/talaba/a/y.txt')).toBeTruthy()
    run('mv a/y.txt a/z.txt'); expect(sh.node('/home/talaba/a/y.txt')).toBeFalsy(); expect(sh.node('/home/talaba/a/z.txt')).toBeTruthy()
    expect(run('rm a').err).toMatch(/katalog/)
    run('rm -r a'); expect(sh.node('/home/talaba/a')).toBeFalsy()
  })
  it('/ ni o\'chirishdan himoya', () => { expect(run('rm -rf /').err).toMatch(/xavfli/) })
})

describe('oqimlar va yo\'naltirish', () => {
  it('> va >> va <', () => {
    run('echo salom > f.txt'); expect(sh.read('/home/talaba/f.txt')).toBe('salom\n')
    run('echo yana >> f.txt'); expect(sh.read('/home/talaba/f.txt')).toBe('salom\nyana\n')
    expect(out('cat < f.txt')).toBe('salom\nyana\n')
  })
  it('2>&1 tartibi muhim', () => {
    const a = run('ls /etc/hostname /yoq > ok.txt 2>&1')
    expect(a.err).toBe(''); expect(sh.read('/home/talaba/ok.txt')).toMatch(/yo'q/)
    const b = run('ls /etc/hostname /yoq 2>&1 > bad.txt')
    expect(b.err).toMatch(/yo'q/); expect(sh.read('/home/talaba/bad.txt')).not.toMatch(/yo'q/)
  })
  it('2>/dev/null xatolarni yashiradi', () => { expect(run('ls /yoq 2>/dev/null').err).toBe('') })
  it('pipe zanjiri', () => {
    expect(out("echo -e 'b\\na\\nb' | sort | uniq -c | sort -rn | head -1").trim()).toMatch(/^2 b$/)
  })
})

describe('matn vositalari', () => {
  it('grep: -c, -i, -v, -n, -r, -o, -E', () => {
    expect(out('grep -c ERROR loyiha/logs/app.log').trim()).toBe('2')
    expect(out('grep -i error loyiha/logs/app.log').split('\n').filter(Boolean)).toHaveLength(2)
    expect(out('grep -v ERROR loyiha/logs/app.log').split('\n').filter(Boolean)).toHaveLength(4)
    expect(out('grep -n ERROR loyiha/logs/app.log')).toMatch(/^2:/m)
    expect(out('grep -rl ERROR loyiha')).toMatch(/app\.log/)
    expect(run('grep YOQSO notes.md').code).toBe(1)
  })
  it('awk maydonlar va shartlar', () => {
    sh.user = 'root'
    expect(out("awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -1").trim()).toMatch(/^5 203\.0\.113\.7$/)
    expect(out("awk -F: '$3 == 0 {print $1}' /etc/passwd").trim()).toBe('root')
  })
  it('sed almashtirish va -i', () => {
    expect(out("echo 'Port 22' | sed 's/22/2222/'").trim()).toBe('Port 2222')
    sh.user = 'root'
    run("sed -i 's/^PermitRootLogin yes$/PermitRootLogin no/' /etc/ssh/sshd_config")
    expect(sh.read('/etc/ssh/sshd_config')).toMatch(/PermitRootLogin no/)
  })
  it('cut, wc, tr, head, tail', () => {
    expect(out("echo 'a:b:c' | cut -d: -f2").trim()).toBe('b')
    expect(out('wc -l loyiha/logs/app.log').trim().split(/\s+/)[0]).toBe('6')
    expect(out("echo abc | tr a-z A-Z").trim()).toBe('ABC')
    expect(out('head -2 loyiha/logs/app.log').split('\n').filter(Boolean)).toHaveLength(2)
    expect(out('tail -1 loyiha/logs/app.log').trim()).toBe('INFO ok')
  })
})

describe('find va xargs', () => {
  it('-name, -type, -size, -maxdepth', () => {
    sh.user = 'root'
    const logs = out("find /var -name '*.log'")
    expect(logs).toMatch(/access\.log/); expect(logs).toMatch(/error\.log/)
    expect(out("find /home -type d -maxdepth 2")).toMatch(/loyiha/)
    expect(out("find /home -name '*.md'")).toMatch(/notes\.md/)
  })
  it('xargs bilan birga', () => {
    run('mkdir t && touch t/a.tmp t/b.tmp')
    run("find t -name '*.tmp' | xargs rm")
    expect(Object.keys(sh.node('/home/talaba/t')!.children!)).toHaveLength(0)
  })
})

describe('ruxsatlar va foydalanuvchilar', () => {
  it('chmod sakkizlik va belgili', () => {
    run('chmod 600 loyiha/.env')
    expect(sh.node('/home/talaba/loyiha/.env')!.mode & 0o777).toBe(0o600)
    run('chmod u+x loyiha/deploy.sh')
    expect(sh.node('/home/talaba/loyiha/deploy.sh')!.mode & 0o100).toBeTruthy()
  })
  it('boshqa foydalanuvchi faylini o\'qib bo\'lmaydi, sudo bilan mumkin', () => {
    expect(run('cat /var/log/nginx/access.log').err).toMatch(/Ruxsat berilmagan/)
    expect(run('sudo cat /var/log/nginx/access.log').out).toMatch(/203\.0\.113\.7/)
  })
  it('id va whoami', () => {
    expect(out('whoami').trim()).toBe('talaba')
    expect(out('id')).toMatch(/uid=1000\(talaba\)/)
  })
  it('root bo\'lmagan foydalanuvchi chown qila olmaydi', () => {
    expect(run('chown root /home/talaba/notes.md').err).toMatch(/ruxsat yo'q/)
  })
})

describe('jarayonlar va systemd', () => {
  it('ps va kill', () => {
    expect(out('ps aux')).toMatch(/nginx/)
    expect(run('kill 3811').err).toMatch(/ruxsat yo'q/)     // boshqa foydalanuvchi
    run('sudo kill 3811')
    expect(sh.procs.some((p) => p.pid === 3811)).toBe(false)
  })
  it('systemctl status / start / stop', () => {
    expect(out('systemctl status nginx')).toMatch(/active \(running\)/)
    expect(run('systemctl status myapp').code).toBe(3)
    expect(run('systemctl start myapp').err).toMatch(/sudo kerak/)
    const r = run('sudo systemctl start myapp')
    expect(r.err).toMatch(/CHDIR|failed/)                    // /opt/myapp yo'q
    run('sudo mkdir -p /opt/myapp && sudo cp /home/talaba/loyiha/app.py /opt/myapp/app.py')
    run('sudo systemctl start myapp')
    expect(sh.units.find((u) => u.name === 'myapp')!.active).toBe(true)
    expect(out('systemctl is-active myapp').trim()).toBe('active')
  })
  it('journalctl -u', () => { expect(out('journalctl -u myapp')).toMatch(/myapp/) })
})

describe('shell xususiyatlari', () => {
  it('o\'zgaruvchilar va $?', () => {
    run('X=salom')
    expect(out('echo $X').trim()).toBe('salom')
    run('false'); expect(out('echo $?').trim()).toBe('1')
    run('true'); expect(out('echo $?').trim()).toBe('0')
  })
  it('&&, ||, ;', () => {
    expect(out('true && echo ha').trim()).toBe('ha')
    expect(out('false && echo ha')).toBe('')
    expect(out('false || echo yoq').trim()).toBe('yoq')
    expect(out('echo a; echo b').trim().split('\n')).toEqual(['a', 'b'])
  })
  it('qo\'shtirnoqlar va glob', () => {
    run('touch f1.log f2.log')
    expect(out('ls *.log').trim().split(/\s+/).sort()).toEqual(['f1.log', 'f2.log'])
    expect(out('echo "*.log"').trim()).toBe('*.log')
    run('V=qiymat')
    expect(out('echo "$V"').trim()).toBe('qiymat')
    expect(out("echo '$V'").trim()).toBe('$V')
  })
  it('noma\'lum buyruq 127 qaytaradi', () => {
    const r = run('yoqbuyruq')
    expect(r.code).toBe(127); expect(r.err).toMatch(/buyruq topilmadi/)
  })
  it('tab to\'ldirish nomzodlari', () => {
    expect(sh.complete('gre')).toContain('grep')
    expect(sh.complete('cat note')).toContain('notes.md')
  })
  it('reset fayl tizimini tiklaydi', () => {
    run('rm -rf loyiha'); expect(sh.node('/home/talaba/loyiha')).toBeFalsy()
    run('reset'); expect(sh.node('/home/talaba/loyiha')).toBeTruthy()
  })
})

describe('topshiriq tekshiruvchilari', () => {
  const check = (id: string, line: string) => {
    const t = SHELL_TASKS.find((x) => x.id === id)!
    const r = sh.run(line)
    return t.check(sh, { line, out: r.out })
  }
  it('t1: ls -la', () => { expect(check('t1', 'ls -la')).toBe(true); expect(check('t1', 'ls')).toBe(false) })
  it('t2: mkdir -p', () => { expect(check('t2', 'mkdir -p ~/loyiha/config/prod')).toBe(true) })
  it('t3: ERROR larni sanash', () => { expect(check('t3', 'grep -c ERROR loyiha/logs/app.log')).toBe(true) })
  it('t5: .env ni 600 qilish', () => { expect(check('t5', 'chmod 600 loyiha/.env')).toBe(true) })
  it('t6: eng faol IP', () => { expect(check('t6', "sudo cat /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -1")).toBe(true) })
  it('t7: sshd_config', () => { expect(check('t7', "sudo sed -i 's/^PermitRootLogin yes$/PermitRootLogin no/' /etc/ssh/sshd_config")).toBe(true) })
  it('t9: og\'ir jarayonni to\'xtatish', () => { expect(check('t9', 'sudo kill 3811')).toBe(true) })
  it('t11: yo\'naltirish', () => { expect(check('t11', 'ls /etc /yoq > ~/natija.txt 2>&1')).toBe(true) })
  it('t12: bash shell li foydalanuvchilar', () => { expect(check('t12', 'grep bash /etc/passwd | cut -d: -f1')).toBe(true) })
  it('barcha topshiriqlarda ishora va maqsad bor', () => {
    expect(SHELL_TASKS).toHaveLength(12)
    SHELL_TASKS.forEach((t) => { expect(t.goal.length).toBeGreaterThan(20); expect(t.hint.length).toBeGreaterThan(10) })
  })
})

describe('cron hisoblagichi', () => {
  it('maydonlarni ochadi', () => {
    expect(expandField('*/15', 0, 59)).toEqual([0, 15, 30, 45])
    expect(expandField('1-5', 0, 6)).toEqual([1, 2, 3, 4, 5])
    expect(expandField('1,3,5', 0, 59)).toEqual([1, 3, 5])
    expect(() => expandField('99', 0, 59)).toThrow()
    expect(() => expandField('a', 0, 59)).toThrow()
  })
  it('keyingi ishga tushish vaqtlarini hisoblaydi', () => {
    const from = new Date(2026, 10, 10, 9, 7)   // seshanba
    const r = nextRuns('*/15 9-18 * * 1-5', from, 3)
    expect(r.map((d) => d.getHours() * 60 + d.getMinutes())).toEqual([9 * 60 + 15, 9 * 60 + 30, 9 * 60 + 45])
  })
  it('kunlik jadval ertangi kunga o\'tadi', () => {
    const r = nextRuns('0 3 * * *', new Date(2026, 10, 10, 9, 0), 1)[0]
    expect(r.getDate()).toBe(11); expect(r.getHours()).toBe(3)
  })
  it('noto\'g\'ri ifoda xato beradi', () => { expect(() => nextRuns('* * *', new Date())).toThrow(/5 maydondan/) })
})
