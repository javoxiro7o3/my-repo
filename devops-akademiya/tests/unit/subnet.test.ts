import { describe, expect, it } from 'vitest'
import { compressV6, contains, expandV6, intToIp, ipToInt, prefixForHosts, split, v4info, v6info, vlsm } from '@shared/subnet'

describe('IPv4', () => {
  it('ip ↔ int', () => { expect(ipToInt('192.168.1.1')).toBe(3232235777); expect(intToIp(3232235777)).toBe('192.168.1.1'); expect(intToIp(ipToInt('255.255.255.255'))).toBe('255.255.255.255') })
  it('noto\'g\'ri manzillarni rad etadi', () => { for (const x of ['1.2.3', '256.1.1.1', 'a.b.c.d', '1.2.3.4.5']) expect(() => ipToInt(x)).toThrow(); expect(() => v4info('10.0.0.1/33')).toThrow(); expect(() => v4info('10.0.0.1')).toThrow() })
  it('192.168.10.77/26', () => {
    expect(v4info('192.168.10.77/26')).toMatchObject({ network: '192.168.10.64', broadcast: '192.168.10.127', first: '192.168.10.65', last: '192.168.10.126', hosts: 62, mask: '255.255.255.192', wildcard: '0.0.0.63' })
  })
  it('172.16.45.200/20', () => { expect(v4info('172.16.45.200/20')).toMatchObject({ network: '172.16.32.0', broadcast: '172.16.47.255', hosts: 4094 }) })
  it('/31, /32 va /0 chekka holatlari', () => {
    expect(v4info('10.0.0.4/31')).toMatchObject({ hosts: 2, first: '10.0.0.4', last: '10.0.0.5' })
    expect(v4info('10.0.0.4/32')).toMatchObject({ hosts: 1, network: '10.0.0.4', broadcast: '10.0.0.4' })
    expect(v4info('8.8.8.8/0')).toMatchObject({ network: '0.0.0.0', broadcast: '255.255.255.255' })
  })
  it('manzil turi', () => {
    expect(v4info('10.1.2.3/8').scope).toMatch(/Private/); expect(v4info('172.31.0.1/12').scope).toMatch(/Private/)
    expect(v4info('172.32.0.1/12').scope).toMatch(/Public/); expect(v4info('100.64.0.1/10').scope).toMatch(/CGNAT/); expect(v4info('127.0.0.1/8').scope).toMatch(/Loopback/)
  })
  it('contains', () => { expect(contains('10.20.0.0/22', '10.20.3.255')).toBe(true); expect(contains('10.20.0.0/22', '10.20.4.0')).toBe(false) })
  it('prefixForHosts', () => { expect(prefixForHosts(2)).toBe(30); expect(prefixForHosts(3)).toBe(29); expect(prefixForHosts(62)).toBe(26); expect(prefixForHosts(63)).toBe(25); expect(prefixForHosts(254)).toBe(24) })
  it('split', () => { expect(split('192.168.0.0/24', 26)).toEqual(['192.168.0.0/26', '192.168.0.64/26', '192.168.0.128/26', '192.168.0.192/26']); expect(() => split('10.0.0.0/24', 23)).toThrow() })
  it('VLSM: kattadan kichikka, kesishmasdan', () => {
    const r = vlsm('10.20.0.0/22', [{ name: 'D', hosts: 2 }, { name: 'A', hosts: 200 }, { name: 'C', hosts: 50 }, { name: 'B', hosts: 100 }])
    expect(r.map((x) => x.cidr)).toEqual(['10.20.0.0/24', '10.20.1.0/25', '10.20.1.128/26', '10.20.1.192/30'])
    expect(r.every((x) => x.hosts >= x.need)).toBe(true)
  })
  it('VLSM: joy yetmasa xato', () => { expect(() => vlsm('192.168.1.0/24', [{ name: 'a', hosts: 200 }, { name: 'b', hosts: 100 }])).toThrow(/joy yetmadi/) })
})

describe('IPv6', () => {
  it('kengaytirish va qisqartirish', () => {
    expect(expandV6('2001:db8::1')).toBe('2001:0db8:0000:0000:0000:0000:0000:0001')
    expect(compressV6('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1')
    expect(compressV6('fe80:0:0:0:1:0:0:1')).toBe('fe80::1:0:0:1')
    expect(expandV6('::')).toBe('0000:0000:0000:0000:0000:0000:0000:0000')
  })
  it('xatolar', () => { expect(() => expandV6('1::2::3')).toThrow(); expect(() => expandV6('gggg::1')).toThrow(); expect(() => expandV6('1:2:3')).toThrow() })
  it('v6info', () => {
    const i = v6info('2001:db8:85a3::8a2e:370:7334/64')
    expect(i.network).toBe('2001:db8:85a3::/64'); expect(i.type).toMatch(/Hujjatlar/); expect(i.count).toBe('2^64')
    expect(v6info('fe80::1/64').type).toMatch(/Link-local/); expect(v6info('fd00::1/8').type).toMatch(/Unique Local/); expect(v6info('::1/128').type).toMatch(/Loopback/)
  })
})
