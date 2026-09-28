/**
 * Bucket list. Mark an item done by changing it to { text, done: true }.
 */
export interface BucketItem {
    text: string;
    done?: boolean;
}

export interface BucketCategory {
    emoji: string;
    title: string;
    items: (string | BucketItem)[];
}

export const bucketlist: BucketCategory[] = [
    {
        emoji: "🎯",
        title: "High Priority / Most Meaningful Goals",
        items: [
            { text: "Bike around UBC", done: true },
            { text: "Save $10,000 in my chequing account before the end of 2nd year (Sept–June)", done: true },
            { text: "Complete a marathon", done: true },
            "Go skydiving",
            "Achieve a handstand push-up",
            { text: "Attend a concert (e.g., Bethel Music)", done: true },
            { text: "Attend a local Canadian festival (any kind)", done: true },
            { text: "Get personal training (PT)", done: true },
            { text: "Work out while following a proper diet", done: true },
            "Learn breakdancing",
            "Learn how to do a backflip",
            { text: "Master at least one programming language (Python, C, Java)", done: true },
            "Learn magic tricks",
            "Learn the moonwalk dance",
            { text: "Relearn guitar properly", done: true },
            "Continue studying Japanese",
            { text: "Build an AI program", done: true },
            { text: "Watch a baseball game live", done: true },
            "Watch the World Cup live",
            { text: "Study stock investing", done: true },
            { text: "Donate blood", done: true },
            "Take vocal training lessons",
            "Live with a friend",
            "Get an autograph from a celebrity",
            { text: "Travel alone", done: true },
            "Have chicken & beer (chimaek) by the Han River",
            "Learn photo editing (to a resume-worthy level)",
            { text: "Learn video editing (to a resume-worthy level)", done: true },
            { text: "Volunteer in my field of study (e.g., open projects)", done: true },
            "Volunteer consistently",
            "Give my first salary to my parents",
            "Build a game room",
            { text: "Attend a Charlie Puth concert", done: true },
            "Attend Psy's \"Soaking Show\"",
            { text: "Read 50+ books during university", done: true },
            { text: "Get a driver's license", done: true },
            "Own a house",
            "Own a car",
        ],
    },
    {
        emoji: "🤔",
        title: "Worth Considering (Need More Thought/Resources)",
        items: [
            "Go bungee jumping",
            "Learn surfing",
            "Compose a ~3-minute song",
            "Get a safeguard (lifeguard) certificate",
            "Travel to Europe",
            "Write and publish an autobiography",
            "Join a boxing gym",
            "Learn drums properly",
            { text: "Join a major-related club and become an executive", done: true },
            "Learn speed reading",
            { text: "Travel abroad alone with my girlfriend", done: true },
            "Ride in a sports car",
            "Go on a package trip with friends",
            "Appear in a movie",
            "Learn archery",
            "Watch the League of Legends World Championship live",
            "Visit the pyramids and Sphinx in Egypt",
            "Get celebrity-style makeup in Cheongdam",
            "Do a body profile photoshoot",
            "Get a Japanese cuisine chef certification",
            "Release KakaoTalk emojis",
            "Install a karaoke room at home",
            "Start a book club",
            "Stay at a guesthouse",
            "Get sponsored on Instagram",
            "Receive an expensive gift",
        ],
    },
    {
        emoji: "🔥",
        title: "Interesting but Needs More Motivation/Info",
        items: [
            "Travel alone to the U.S.",
            "Reach 10,000 followers through streaming/content creation",
            "Start a band",
            "Learn a European language",
            "Visit my ancestral hometown",
            "Work at Everland (Amazon ride job)",
            "Learn calligraphy",
            "Ring the \"Golden Bell\" at a bar",
            "Work on a crab fishing boat",
        ],
    },
];

export const itemText = (item: string | BucketItem) => typeof item === 'string' ? item : item.text;
export const itemDone = (item: string | BucketItem) => typeof item !== 'string' && !!item.done;
