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
            "Bike around UBC",
            "Save $10,000 in my chequing account before the end of 2nd year (Sept–June)",
            "Complete a marathon",
            "Go skydiving",
            "Achieve a handstand push-up",
            "Attend a concert (e.g., Bethel Music)",
            "Attend a local Canadian festival (any kind)",
            "Get personal training (PT)",
            "Work out while following a proper diet",
            "Learn breakdancing",
            "Learn how to do a backflip",
            "Master at least one programming language (Python, C, Java)",
            "Learn magic tricks",
            "Learn the moonwalk dance",
            "Relearn guitar properly",
            "Continue studying Japanese",
            "Build an AI program",
            "Watch a baseball game live",
            "Watch the World Cup live",
            "Study stock investing",
            "Donate blood",
            "Take vocal training lessons",
            "Live with a friend",
            "Get an autograph from a celebrity",
            "Travel alone",
            "Have chicken & beer (chimaek) by the Han River",
            "Learn photo editing (to a resume-worthy level)",
            "Learn video editing (to a resume-worthy level)",
            "Volunteer in my field of study (e.g., open projects)",
            "Volunteer consistently",
            "Give my first salary to my parents",
            "Build a game room",
            "Attend a Charlie Puth concert",
            "Attend Psy's \"Soaking Show\"",
            "Read 50+ books during university",
            "Get a driver's license",
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
            "Join a major-related club and become an executive",
            "Learn speed reading",
            "Travel abroad alone with my girlfriend",
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
