import { groupConversationsByDate } from '@/lib/groupConversations'

describe('groupConversationsByDate', () => {
    // Helper to create a date string N days ago from now
    function daysAgo(n: number): string {
        const d = new Date()
        d.setDate(d.getDate() - n)
        return d.toISOString()
    }

    it('groups conversations into correct date buckets', () => {
        const conversations = [
            { id: '1', title: 'Today chat', updated_at: daysAgo(0) },
            { id: '2', title: 'Yesterday chat', updated_at: daysAgo(1) },
            { id: '3', title: 'Three days ago', updated_at: daysAgo(3) },
            { id: '4', title: 'Two weeks ago', updated_at: daysAgo(14) },
        ]

        const result = groupConversationsByDate(conversations)

        expect(result.today).toHaveLength(1)
        expect(result.today[0].id).toBe('1')
        expect(result.yesterday).toHaveLength(1)
        expect(result.yesterday[0].id).toBe('2')
        expect(result.previous7Days).toHaveLength(1)
        expect(result.previous7Days[0].id).toBe('3')
        expect(result.older).toHaveLength(1)
        expect(result.older[0].id).toBe('4')
    })

    it('handles empty array', () => {
        const result = groupConversationsByDate([])

        expect(result.today).toHaveLength(0)
        expect(result.yesterday).toHaveLength(0)
        expect(result.previous7Days).toHaveLength(0)
        expect(result.older).toHaveLength(0)
    })

    it('falls back missing timestamps to today bucket', () => {
        const conversations = [
            { id: '1', title: 'No timestamp' },
            { id: '2', title: 'Also no timestamp' },
        ]

        const result = groupConversationsByDate(conversations)

        expect(result.today).toHaveLength(2)
        expect(result.yesterday).toHaveLength(0)
        expect(result.previous7Days).toHaveLength(0)
        expect(result.older).toHaveLength(0)
    })

    it('prefers updated_at over created_at', () => {
        const conversations = [
            {
                id: '1',
                title: 'Updated today',
                created_at: daysAgo(10), // old creation
                updated_at: daysAgo(0), // but updated today
            },
        ]

        const result = groupConversationsByDate(conversations)

        // Should be in "today" because updated_at is today
        expect(result.today).toHaveLength(1)
        expect(result.older).toHaveLength(0)
    })
})
