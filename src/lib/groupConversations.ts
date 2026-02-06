/**
 * Group conversations by date (Today, Yesterday, Previous 7 Days, Older)
 */

interface ConversationItem {
    id: string;
    title: string;
    created_at?: string;
    updated_at?: string;
}

interface GroupedConversations {
    today: ConversationItem[];
    yesterday: ConversationItem[];
    previous7Days: ConversationItem[];
    older: ConversationItem[];
}

export function groupConversationsByDate(conversations: ConversationItem[]): GroupedConversations {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const grouped: GroupedConversations = {
        today: [],
        yesterday: [],
        previous7Days: [],
        older: [],
    };

    conversations.forEach((conv) => {
        // Use updated_at if available, otherwise fall back to created_at, or assume recent
        const dateStr = conv.updated_at || conv.created_at;
        if (!dateStr) {
            // If no timestamp, assume it's today (fallback for older sessions)
            grouped.today.push(conv);
            return;
        }

        const convDate = new Date(dateStr);
        const convDayStart = new Date(convDate.getFullYear(), convDate.getMonth(), convDate.getDate());

        if (convDayStart.getTime() === today.getTime()) {
            grouped.today.push(conv);
        } else if (convDayStart.getTime() === yesterday.getTime()) {
            grouped.yesterday.push(conv);
        } else if (convDayStart >= sevenDaysAgo) {
            grouped.previous7Days.push(conv);
        } else {
            // Sessions older than 7 days go to 'older' category
            grouped.older.push(conv);
        }
    });

    return grouped;
}
