'use client';

import {
    Plus,
    MessageSquare,
    Info,
    X,
    Trash2,
    MessageCircle,
    Droplet,
    Zap,
    Leaf,
    AlertCircle,
    Apple,
    TrendingDown,
    TrendingUp,
    Dumbbell,
    Tag,
    Moon,
    ShoppingBag,
    Flame,
    Heart,
    HelpCircle,
    Settings,
    PenLine
} from 'lucide-react';
import { groupConversationsByDate } from '../lib/groupConversations';
import { LucideIcon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useSessionStore } from '../stores/useSessionStore';
import { useUIStore } from '../stores/useUIStore';


// 1. თემატური აიკონები (პრიორიტეტის მიხედვით)
const THEME_ICONS: Record<string, LucideIcon> = {
    promos: Tag,            // აქციები (ყველაზე პრიორიტეტული)
    sleep: Moon,            // ძილი
    dietary: Leaf,          // "გარეშე", ვეგანური
    weight_loss: Flame,     // ცხიმისმწველები
    energy: Zap,            // ენერგია, პრე-ვორკაუტი, პამპი
    recovery: Droplet,      // აღდგენა, ამინოები
    health: Heart,          // ჯანმრთელობა, ვიტამინები, სექსუალური
    accessories: ShoppingBag, // აქსესუარები
    muscle: Dumbbell,       // პროტეინი, გეინერი, კრეატინი (Default სპორტული)
    learning: HelpCircle,   // კითხვები
    default: MessageCircle
};

// 2. სრული ქივორდების სია (მენიუს მიხედვით)
const KEYWORDS: Record<string, string[]> = {
    // --- 1. აქციები და ბანდლები (TOP PRIORITY) ---
    promos: [
        'aqcia', 'akcia', 'აქცია',
        'fasdakleba', 'sale', 'ფასდაკლება',
        '2 ertis', '2 1-is', '2 1', 'ori ertis', 'ორი ერთის',
        '3 oris', '3 1-is', 'sami oris', 'სამი ორის',
        'upaso', 'ufaso', 'gift', 'shachuqari', 'უფასო', 'საჩუქარი',
        'bundle', 'bandli', 'komplekti', 'ბანდლი', 'კომპლექტი',
        'dazoge', 'save', 'დაზოგე'
    ],

    // --- 2. სპეციფიკური დიეტური ("გარეშე") ---
    dietary: [
        'gareshe', 'free', 'გარეშე', // გლუტენის გარეშე, შაქრის გარეშე
        'gluten', 'gluteni', 'გლუტენი',
        'sugar', 'shaqari', 'შაქარი',
        'lactose', 'laqtoza', 'ლაქტოზა',
        'vegan', 'mcenareuli', 'plant', 'ვეგან', 'მცენარეული',
        'soy', 'soio', 'სოიო',
        'txili', 'nuts', 'თხილი'
    ],

    // --- 3. ძილი და რელაქსაცია ---
    sleep: [
        'sleep', 'dzili', 'udziloba', 'ძილი', 'უძილობა',
        'melatonin', 'melatonini', 'მელატონინი',
        'zma', 'relaxation', 'ragulacia', 'რეგულაცია' // ძილის რეგულაცია
    ],

    // --- 4. წონის კლება (ცხიმისმწველები) ---
    weight_loss: [
        'weight loss', 'kleba', 'dakleba', 'wona', 'წონა', 'კლება', 'დაკლება',
        'fat', 'burner', 'cximi', 'cximismcweli', 'ცხიმი', 'ცხიმისმწველი',
        'carnitine', 'karnitini', 'კარნიტინი',
        'cla', 'thermogenic', 'termogenuli', 'თერმოგენული',
        'gamoshroba', 'shred', 'dry', 'გამოშრობა'
    ],

    // --- 5. ენერგია და პრე-ვორკაუტი ---
    energy: [
        'energy', 'energia', 'energiis', 'ენერგია', 'ენერგიის',
        'pre-workout', 'preworkout', 'varchishamde', 'ვარჯიშამდე',
        'pump', 'pampi', 'fampi', 'პამპი', 'ფამპი',
        'carbs', 'naxshirwylebi', 'ნახშირწყლები',
        'stimulant', 'stimulatori', 'სტიმულატორი'
    ],

    // --- 6. აღდგენა და ამინოები ---
    recovery: [
        'recovery', 'agdgena', 'varchishis shemdeg', 'აღდგენა', 'ვარჯიშის შემდეგ',
        'amino', 'aminomzhavebi', 'ამინო', 'ამინომჟავები',
        'bcaa',
        'glutamine', 'glutamini', 'გლუტამინი',
        'arginine', 'arginini', 'არგინინი',
        'citrulline', 'citrulini', 'ციტრულინი'
    ],

    // --- 7. ჯანმრთელობა (გული, სახსრები, სექსუალური, ვიტამინები) ---
    health: [
        'health', 'jamrteloba', 'janmrteloba', 'ჯანმრთელობა',
        'heart', 'guli', 'გული',
        'sexual', 'seqsualuri', 'potencia', 'სექსუალური', 'პოტენცია',
        'joints', 'saxsrebi', 'სახსრები',
        'glucosamine', 'glukozamini', 'გლუკოზამინი',
        'chondroitin', 'qondroitini', 'ქონდროიტინი',
        'vitamin', 'vitaminebi', 'ვიტამინები',
        'mineral', 'mineralebi', 'მინერალები',
        'multi', 'multivitamini', 'მულტივიტამინი'
    ],

    // --- 8. აქსესუარები ---
    accessories: [
        'accessory', 'aqsesuari', 'aqsesuarebi', 'აქსესუარები',
        'shaker', 'sheikeri', 'შეიკერი',
        'bottle', 'botli', 'flask', 'ბოთლი', 'ფლასკი',
        'glove', 'xeltatmani', 'ხელთათმანი',
        'belt', 'gvedi', 'damcheri', 'ღვედი', 'დამჭერი',
        'mat', 'xalicha', 'ხალიჩა',
        'band', 'lenti', 'rezini', 'ლენტი', 'რეზინი'
    ],

    // --- 9. კუნთი / ძალა / პროტეინი (Default სპორტული კატეგორია) ---
    muscle: [
        'muscle', 'kunti', 'masa', 'masis', 'კუნთი', 'მასა', 'მასის',
        'strength', 'dzala', 'dzalis', 'ძალა', 'ძალის',
        'protein', 'proteini', 'პროტეინი',
        'whey', 'vei', 'ვეი',
        'isolate', 'izolat', 'იზოლატი',
        'concentrate', 'koncentrati', 'კონცენტრატი',
        'casein', 'kazeini', 'კაზეინი',
        'beef', 'sakonlis', 'საქონლის',
        'gainer', 'geineri', 'გეინერი',
        'creatine', 'kreatini', 'კრეატინი',
        'monohydrate', 'monohidrati', 'მონოჰიდრატი',
        'anabolic', 'anabolikebi', 'ანაბოლიკები'
    ],

    // კითხვები / დამწყები
    learning: [
        'help', 'daxmareba', 'დახმარება',
        'rcheva', 'mirchie', 'რჩევა', 'მირჩიე',
        'damcyebi', 'newbie', 'დამწყები',
        'rogor', 'როგორ',
        'ra aris', 'რა არის'
    ]
};

// Get appropriate icon based on conversation title (priority order matters)
function getConversationIcon(title: string): LucideIcon {
    const lowerTitle = title.toLowerCase();

    // Check keywords in priority order (as defined in THEME_ICONS object)
    const themeOrder = [
        'promos', 'sleep', 'dietary', 'weight_loss', 'energy',
        'recovery', 'health', 'accessories', 'muscle', 'learning'
    ];

    for (const theme of themeOrder) {
        const keywords = KEYWORDS[theme];
        if (keywords && keywords.some(kw => lowerTitle.includes(kw.toLowerCase()))) {
            return THEME_ICONS[theme];
        }
    }

    return THEME_ICONS.default; // default
}

// Format time as "16:23" (24-hour format, Tbilisi UTC+4)
function formatTime(dateStr?: string): string {
    if (!dateStr) return '';

    // Backend sends UTC time without 'Z', manually append it to force UTC parsing
    const utcString = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    const date = new Date(utcString);

    // Convert to Tbilisi timezone (UTC+4)
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Tbilisi'
    });
}

export function Sidebar() {
    // ── Zustand: Session Store ──
    const conversations = useSessionStore((s) => s.conversations);
    const activeId = useSessionStore((s) => s.activeId);
    const setActiveId = useSessionStore((s) => s.setActiveId);
    const startNewChat = useSessionStore((s) => s.startNewChat);
    const loadSessionHistory = useSessionStore((s) => s.loadSessionHistory);

    // ── Zustand: UI Store ──
    const sidebarOpen = useUIStore((s) => s.sidebarOpen);
    const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
    const openDeleteConfirm = useUIStore((s) => s.openDeleteConfirm);



    // Settings popover state
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const settingsMenuRef = useRef<HTMLDivElement>(null);
    const settingsButtonRef = useRef<HTMLButtonElement>(null);

    // Map conversations to sidebar items
    const sidebarItems = conversations.map((c) => ({
        id: c.id,
        title: c.title,
        created_at: c.created_at,
        updated_at: c.updated_at,
    }));

    // Group conversations by date
    const grouped = groupConversationsByDate(sidebarItems);

    // Click outside to close settings popover
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                showSettingsMenu &&
                settingsMenuRef.current &&
                settingsButtonRef.current &&
                !settingsMenuRef.current.contains(event.target as Node) &&
                !settingsButtonRef.current.contains(event.target as Node)
            ) {
                setShowSettingsMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showSettingsMenu]);

    const handleSelect = (id: string) => {
        setActiveId(id);
        setSidebarOpen(false);
        // Load history if not already loaded
        const conv = conversations.find(c => c.id === id);
        if (conv && conv.messages.length === 0) {
            loadSessionHistory(id);
        }
    };

    const handleNewChat = () => {
        startNewChat();
        setSidebarOpen(false);
    };

    const closeSidebar = () => setSidebarOpen(false);

    const renderConversationGroup = (title: string, convs: { id: string; title: string; created_at?: string; updated_at?: string }[]) => {
        if (convs.length === 0) return null;

        return (
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 px-3 mb-3">
                    {title}
                </h3>
                <div className="space-y-0.5">
                    {convs.map((conv) => {
                        const isActive = activeId === conv.id;
                        const timestamp = formatTime(conv.updated_at || conv.created_at);
                        const IconComponent = getConversationIcon(conv.title);

                        return (
                            <button
                                key={conv.id}
                                onClick={() => handleSelect(conv.id)}
                                data-testid={`sidebar-conversation-${conv.id}`}
                                className={`w-full min-w-0 text-left px-3 py-2.5 rounded-2xl text-sm transition-all duration-200 flex items-center gap-3 group relative overflow-hidden cursor-pointer ${isActive
                                    ? 'text-foreground font-medium'
                                    : 'text-muted-foreground hover:bg-[#f0f4f9] hover:text-foreground'
                                    }`}
                                style={isActive ? { backgroundColor: 'rgba(10, 115, 100, 0.15)' } : {}}
                            >
                                {/* Dynamic Theme Icon */}
                                <IconComponent
                                    className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#0A7364]' : 'text-gray-400'}`}
                                    strokeWidth={1.5}
                                />

                                {/* Title */}
                                <span className="flex-1 truncate">
                                    {conv.title}
                                </span>

                                {/* Timestamp */}
                                {timestamp && (
                                    <span className={`text-xs flex-shrink-0 ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {timestamp}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Mobile backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={closeSidebar}
                />
            )}

            <div
                className={`
                fixed inset-y-0 left-0 z-50 flex-shrink-0 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 w-[85%] lg:w-72
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
            >
                <div className="h-full flex flex-col bg-sidebar overflow-hidden" data-testid="sidebar-container">
                    {/* New conversation button - Gemini Style */}
                    <div className="p-4">
                        <button
                            onClick={handleNewChat}
                            aria-label="ახალი საუბრის დაწყება"
                            tabIndex={0}
                            className="flex items-center gap-3 py-3 px-4 rounded-2xl bg-[#E8F4F2] text-[#0a7364] hover:bg-[#d0ebe6] transition-all duration-150 ease-in-out active:scale-[0.98] cursor-pointer"
                            data-testid="sidebar-new-chat"
                        >
                            <PenLine className="w-5 h-5" strokeWidth={1.5} />
                            <span className="text-base font-medium">ახალი საუბარი</span>
                        </button>
                    </div>

                    {/* Close button - Mobile ONLY */}
                    <button
                        onClick={closeSidebar}
                        className="close-btn-modern absolute top-4 right-4 lg:hidden z-50"
                        data-testid="sidebar-close"
                        aria-label="დახურვა"
                    >
                        <X className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                    <div className="flex-1 px-4 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
                        {conversations.length === 0 ? (
                            <div className="text-sm text-muted-foreground/60 py-8 text-center">
                                საუბრები არ არის...
                            </div>
                        ) : (
                            <>
                                {renderConversationGroup('დღეს', grouped.today)}
                                {renderConversationGroup('გუშინ', grouped.yesterday)}
                                {renderConversationGroup('წინა 7 დღე', grouped.previous7Days)}
                                {renderConversationGroup('ძველი', grouped.older)}
                            </>
                        )}
                    </div>

                    {/* Settings footer with popover */}
                    <div className="p-4 relative">
                        <button
                            ref={settingsButtonRef}
                            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors w-full px-3 py-2 rounded-2xl hover:bg-sidebar-accent cursor-pointer"
                        >
                            <Settings className="w-4 h-4" strokeWidth={1.5} />
                            <span>პარამეტრები</span>
                        </button>

                        {/* Settings Popover */}
                        {showSettingsMenu && (
                            <div
                                ref={settingsMenuRef}
                                className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
                            >
                                <button
                                    className="flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors w-full px-4 py-2.5 cursor-pointer"
                                    onClick={() => {
                                        setShowSettingsMenu(false);
                                        // Placeholder for About Assistant action
                                        console.log('About Assistant clicked');
                                    }}
                                >
                                    <Info className="w-4 h-4" strokeWidth={1.5} />
                                    <span>ასისტენტის შესახებ</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setShowSettingsMenu(false);
                                        openDeleteConfirm();
                                    }}
                                    className="flex items-center gap-2 text-sm text-red-500 hover:bg-red-50 transition-colors w-full px-4 py-2.5 cursor-pointer"
                                >
                                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                    <span>წაშალე მონაცემები</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
