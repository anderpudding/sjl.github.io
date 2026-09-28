/** Education history as traceroute hops — rendered by /journey and the globe. */
export interface School {
    name: string;
    level: string;
    href?: string;
}

export interface Hop {
    city: string;
    native: string;
    host: string;
    lat: number;
    lon: number;
    schools: School[];
}

export const hops: Hop[] = [
    {
        city: 'Seoul', native: '서울', host: 'seoul.kr', lat: 37.5665, lon: 126.978,
        schools: [
            { name: '서울소망어린이집', level: 'Kindergarten' },
            { name: '서울KidsCafe', level: 'Kindergarten' },
            { name: '서울버들초등학교', level: 'Elementary School', href: 'https://seoulbeodle.sen.es.kr/' },
        ],
    },
    {
        city: 'Tokyo', native: '東京', host: 'tokyo.jp', lat: 35.6762, lon: 139.6503,
        schools: [
            { name: '동경한국학교', level: 'Elementary School', href: 'http://www.tokos.ed.jp/smain.html' },
            { name: '世田谷区立松沢小学校', level: 'Elementary School', href: 'https://school.setagaya.ed.jp/mawa' },
            { name: '嘉悦学園かえつ有明中学校', level: 'Middle School', href: 'https://www.ariake.kaetsu.ac.jp/' },
        ],
    },
    {
        city: 'Abbotsford', native: 'BC, Canada', host: 'abbotsford.ca', lat: 49.0504, lon: -122.3045,
        schools: [
            { name: 'Yale Secondary School', level: 'High School', href: 'https://yale.abbyschools.ca/' },
        ],
    },
    {
        city: 'Vancouver', native: 'BC, Canada', host: 'ubc.ca', lat: 49.2606, lon: -123.246,
        schools: [
            {
                name: 'University of British Columbia',
                level: 'Combined Major in Computer Science and Mathematics',
                href: 'https://vancouver.calendar.ubc.ca/faculties-colleges-and-schools/faculty-science/bachelor-science/mathematics',
            },
        ],
    },
];

/** Great-circle distance in km between two hops. */
export function distanceKm(a: Hop, b: Hop): number {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
}
