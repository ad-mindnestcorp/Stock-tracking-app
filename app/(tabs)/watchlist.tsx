import LineChart from "@/components/line-chart";
import { SkeletonListScreen } from "@/components/skeleton";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/context/theme-context";
import {
    useWatchlists,
    useWatchlistStocks,
    useCreateWatchlist,
    useRenameWatchlist,
    useDeleteWatchlist,
    useAddStockToWatchlist,
} from "@/hooks/use-watchlist";
import { useLivePrices, type LivePrice } from "@/hooks/use-live-prices";
import {
    watchlistsApi,
    type Watchlist,
    type StockSearchResult,
    type WatchlistStock,
} from "@/lib/api";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";

export default function WatchlistScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [infoVisible, setInfoVisible] = useState(false);
    const [createVisible, setCreateVisible] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [searchVisible, setSearchVisible] = useState(false);
    const [optionsTarget, setOptionsTarget] = useState<Watchlist | null>(null);
    const [renameTarget, setRenameTarget] = useState<Watchlist | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Watchlist | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const { data: watchlists = [], isLoading: watchlistsLoading } = useWatchlists();
    const { mutate: deleteWatchlist } = useDeleteWatchlist();

    // Auto-select first watchlist on load or after deletion
    useEffect(() => {
        if (watchlists.length === 0) return;
        if (!selectedId || !watchlists.find((wl) => wl.id === selectedId)) {
            setSelectedId(watchlists[0].id);
        }
    }, [watchlists, selectedId]);

    const {
        data: stocks = [],
        isLoading: stocksLoading,
        isError,
        error,
        refetch,
        isRefetching,
    } = useWatchlistStocks(selectedId ?? "");

    const { mutate: addStock } = useAddStockToWatchlist();

    const stockSymbols = useMemo(() => stocks.map((s) => s.symbol), [stocks]);
    const livePrices = useLivePrices(stockSymbols);

    const isLoading = watchlistsLoading || (!!selectedId && stocksLoading);

    return (
        <SafeAreaView style={styles.safe}>
            {/* Dismiss overlay */}
            {dropdownOpen && (
                <TouchableWithoutFeedback onPress={() => setDropdownOpen(false)}>
                    <View style={styles.dropdownOverlay} />
                </TouchableWithoutFeedback>
            )}

            {/* Header */}
            <View style={styles.pageHeader}>
                {/* Left: title + info */}
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>Watchlist</Text>
                    <TouchableOpacity
                        onPress={() => setInfoVisible(true)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Indicator explanations"
                        accessibilityRole="button"
                    >
                        <Ionicons
                            name="information-circle-outline"
                            size={20}
                            color={colors.textMuted}
                        />
                    </TouchableOpacity>
                </View>

                {/* Right: search icon + watchlist picker */}
                <View style={styles.headerRight}>
                <TouchableOpacity
                    onPress={() => setSearchVisible((v) => !v)}
                    style={styles.searchIconBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel={searchVisible ? "Close search" : "Search stocks"}
                    accessibilityRole="button"
                >
                    <Ionicons
                        name={searchVisible ? "close" : "search"}
                        size={20}
                        color={colors.textSecondary}
                    />
                </TouchableOpacity>
                <View style={styles.wlPickerContainer}>
                    <TouchableOpacity
                        style={styles.wlPickerBtn}
                        onPress={() => setDropdownOpen((v) => !v)}
                        accessibilityRole="button"
                        accessibilityLabel="Select watchlist"
                    >
                        <Text style={styles.wlPickerText} numberOfLines={1}>
                            {watchlists.find((wl) => wl.id === selectedId)?.name ?? "Watchlist"}
                        </Text>
                        <Ionicons
                            name={dropdownOpen ? "chevron-up" : "chevron-down"}
                            size={14}
                            color={colors.textSecondary}
                        />
                    </TouchableOpacity>

                    {dropdownOpen && (
                        <View
                            style={[
                                styles.wlDropdown,
                                { backgroundColor: colors.surface, borderColor: colors.border },
                            ]}
                        >
                            {watchlists.map((wl) => {
                                const isSelected = wl.id === selectedId;
                                return (
                                    <TouchableOpacity
                                        key={wl.id}
                                        style={[
                                            styles.wlDropdownRow,
                                            isSelected && { backgroundColor: colors.primary + "18" },
                                        ]}
                                        onPress={() => {
                                            setSelectedId(wl.id);
                                            setDropdownOpen(false);
                                        }}
                                        onLongPress={() => {
                                            setDropdownOpen(false);
                                            setOptionsTarget(wl);
                                        }}
                                        delayLongPress={400}
                                        accessibilityRole="menuitem"
                                        accessibilityLabel={`${wl.name}${isSelected ? ", selected" : ""}, long press to manage`}
                                        accessibilityState={{ selected: isSelected }}
                                    >
                                        <Ionicons
                                            name="checkmark"
                                            size={16}
                                            color={isSelected ? colors.primary : "transparent"}
                                        />
                                        <Text
                                            style={[
                                                styles.wlDropdownText,
                                                { color: isSelected ? colors.primary : colors.textPrimary },
                                            ]}
                                        >
                                            {wl.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                            <View style={[styles.wlDropdownDivider, { backgroundColor: colors.border }]} />
                            <TouchableOpacity
                                style={styles.wlDropdownRow}
                                onPress={() => {
                                    setDropdownOpen(false);
                                    setCreateVisible(true);
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="Create new watchlist"
                            >
                                <Ionicons name="add" size={16} color={colors.primary} />
                                <Text style={[styles.wlDropdownText, { color: colors.primary }]}>
                                    New Watchlist
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
                </View>
            </View>

            {/* Subtitle */}
            <View style={styles.subtitleRow}>
                <Text style={styles.subtitle}>
                    {stocks.length} stock{stocks.length !== 1 ? "s" : ""} monitored
                </Text>
            </View>

            <IndicatorInfoModal
                visible={infoVisible}
                onClose={() => setInfoVisible(false)}
                colors={colors}
                styles={styles}
            />

            {/* Search + add input */}
            {searchVisible && (
                <StockSearchInput
                    watchedSymbols={stocks.map((s) => s.symbol)}
                    onAdd={(symbol, company_name) => {
                        if (selectedId) addStock({ watchlistId: selectedId, symbol, company_name });
                        setSearchVisible(false);
                    }}
                    colors={colors}
                    styles={styles}
                />
            )}

            {isError && (
                <View style={styles.errorCard}>
                    <Text style={styles.errorText}>
                        {error instanceof Error
                            ? error.message
                            : "Failed to load watchlist"}
                    </Text>
                    <TouchableOpacity onPress={() => refetch()}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            )}

            {isLoading ? (
                <SkeletonListScreen count={5} />
            ) : stocks.length === 0 ? (
                <View style={styles.empty}>
                    <Ionicons name="star-outline" size={56} color={colors.border} />
                    <Text style={styles.emptyTitle}>No stocks yet</Text>
                    <Text style={styles.emptyText}>
                        Add stock symbols above to start monitoring for RSI and 52-week
                        alerts.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={stocks}
                    keyExtractor={(item) => item.symbol}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching}
                            onRefresh={refetch}
                            tintColor={colors.primary}
                        />
                    }
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                        <WatchlistRow
                            stock={item}
                            livePrice={livePrices[item.symbol]}
                            colors={colors}
                            styles={styles}
                        />
                    )}
                />
            )}

            {/* Modals */}
            <CreateWatchlistModal
                visible={createVisible}
                onClose={() => setCreateVisible(false)}
                colors={colors}
                styles={styles}
            />

            <WatchlistOptionsModal
                watchlist={optionsTarget}
                onClose={() => setOptionsTarget(null)}
                onRename={(wl) => {
                    setOptionsTarget(null);
                    setRenameTarget(wl);
                }}
                onDelete={(wl) => {
                    setOptionsTarget(null);
                    setDeleteTarget(wl);
                }}
                colors={colors}
                styles={styles}
            />

            <RenameWatchlistModal
                watchlist={renameTarget}
                onClose={() => setRenameTarget(null)}
                colors={colors}
                styles={styles}
            />

            <DeleteWatchlistModal
                watchlist={deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={() => {
                    if (deleteTarget) deleteWatchlist(deleteTarget.id);
                    setDeleteTarget(null);
                }}
                colors={colors}
                styles={styles}
            />
        </SafeAreaView>
    );
}

// ─── CreateWatchlistModal ─────────────────────────────────────────────────────

function CreateWatchlistModal({
    visible,
    onClose,
    colors,
    styles,
}: {
    visible: boolean;
    onClose: () => void;
    colors: ReturnType<typeof useTheme>["colors"];
    styles: ReturnType<typeof createStyles>;
}) {
    const [name, setName] = useState("");
    const { mutate: create, isPending } = useCreateWatchlist();

    const handleCreate = () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        create(trimmed, {
            onSuccess: () => {
                setName("");
                onClose();
            },
        });
    };

    const handleClose = () => {
        setName("");
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
        >
            <TouchableWithoutFeedback onPress={handleClose}>
                <View style={styles.modalOverlay} />
            </TouchableWithoutFeedback>
            <View
                style={[
                    styles.modalSheet,
                    { backgroundColor: colors.background, borderColor: colors.border },
                ]}
            >
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                        New Watchlist
                    </Text>
                    <TouchableOpacity
                        onPress={handleClose}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="close" size={22} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>
                <View style={styles.modalInputSection}>
                    <TextInput
                        style={[
                            styles.modalInput,
                            {
                                backgroundColor: colors.surface,
                                color: colors.textPrimary,
                                borderColor: colors.border,
                            },
                        ]}
                        placeholder="e.g. Tech, Dividend, Swing Trades…"
                        placeholderTextColor={colors.textMuted}
                        value={name}
                        onChangeText={setName}
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={handleCreate}
                        maxLength={40}
                    />
                    <TouchableOpacity
                        style={[
                            styles.modalPrimaryBtn,
                            { backgroundColor: colors.primary },
                            (!name.trim() || isPending) && styles.modalBtnDisabled,
                        ]}
                        onPress={handleCreate}
                        disabled={!name.trim() || isPending}
                    >
                        {isPending ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.modalPrimaryBtnText}>Create</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ─── WatchlistOptionsModal ────────────────────────────────────────────────────

function WatchlistOptionsModal({
    watchlist,
    onClose,
    onRename,
    onDelete,
    colors,
    styles,
}: {
    watchlist: Watchlist | null;
    onClose: () => void;
    onRename: (wl: Watchlist) => void;
    onDelete: (wl: Watchlist) => void;
    colors: ReturnType<typeof useTheme>["colors"];
    styles: ReturnType<typeof createStyles>;
}) {
    return (
        <Modal
            visible={watchlist != null}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.modalOverlay} />
            </TouchableWithoutFeedback>
            <View
                style={[
                    styles.modalSheet,
                    { backgroundColor: colors.background, borderColor: colors.border },
                ]}
            >
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                    <Text
                        style={[styles.modalTitle, { color: colors.textPrimary }]}
                        numberOfLines={1}
                    >
                        {watchlist?.name}
                    </Text>
                    <TouchableOpacity
                        onPress={onClose}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="close" size={22} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>
                <View style={styles.optionsContent}>
                    <TouchableOpacity
                        style={[
                            styles.optionRow,
                            { borderColor: colors.border, backgroundColor: colors.surface },
                        ]}
                        onPress={() => watchlist && onRename(watchlist)}
                    >
                        <Ionicons name="pencil-outline" size={20} color={colors.textPrimary} />
                        <Text style={[styles.optionText, { color: colors.textPrimary }]}>
                            Rename
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.optionRow,
                            { borderColor: colors.border, backgroundColor: colors.surface },
                        ]}
                        onPress={() => watchlist && onDelete(watchlist)}
                    >
                        <Ionicons name="trash-outline" size={20} color={colors.negative} />
                        <Text style={[styles.optionText, { color: colors.negative }]}>
                            Delete
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ─── RenameWatchlistModal ─────────────────────────────────────────────────────

function RenameWatchlistModal({
    watchlist,
    onClose,
    colors,
    styles,
}: {
    watchlist: Watchlist | null;
    onClose: () => void;
    colors: ReturnType<typeof useTheme>["colors"];
    styles: ReturnType<typeof createStyles>;
}) {
    const [name, setName] = useState("");
    const { mutate: rename, isPending } = useRenameWatchlist();

    useEffect(() => {
        if (watchlist) setName(watchlist.name);
    }, [watchlist]);

    const handleRename = () => {
        const trimmed = name.trim();
        if (!trimmed || !watchlist) return;
        rename(
            { id: watchlist.id, name: trimmed },
            { onSuccess: onClose }
        );
    };

    return (
        <Modal
            visible={watchlist != null}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.modalOverlay} />
            </TouchableWithoutFeedback>
            <View
                style={[
                    styles.modalSheet,
                    { backgroundColor: colors.background, borderColor: colors.border },
                ]}
            >
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                        Rename Watchlist
                    </Text>
                    <TouchableOpacity
                        onPress={onClose}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="close" size={22} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>
                <View style={styles.modalInputSection}>
                    <TextInput
                        style={[
                            styles.modalInput,
                            {
                                backgroundColor: colors.surface,
                                color: colors.textPrimary,
                                borderColor: colors.border,
                            },
                        ]}
                        placeholder="Watchlist name"
                        placeholderTextColor={colors.textMuted}
                        value={name}
                        onChangeText={setName}
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={handleRename}
                        maxLength={40}
                    />
                    <TouchableOpacity
                        style={[
                            styles.modalPrimaryBtn,
                            { backgroundColor: colors.primary },
                            (!name.trim() || isPending) && styles.modalBtnDisabled,
                        ]}
                        onPress={handleRename}
                        disabled={!name.trim() || isPending}
                    >
                        {isPending ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.modalPrimaryBtnText}>Save</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ─── DeleteWatchlistModal ─────────────────────────────────────────────────────

function DeleteWatchlistModal({
    watchlist,
    onClose,
    onConfirm,
    colors,
    styles,
}: {
    watchlist: Watchlist | null;
    onClose: () => void;
    onConfirm: () => void;
    colors: ReturnType<typeof useTheme>["colors"];
    styles: ReturnType<typeof createStyles>;
}) {
    return (
        <Modal
            visible={watchlist != null}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.modalOverlay} />
            </TouchableWithoutFeedback>
            <View style={styles.alertDialogWrap}>
                <View
                    style={[
                        styles.alertDialog,
                        { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                >
                    <Text style={[styles.alertTitle, { color: colors.textPrimary }]}>
                        Delete &ldquo;{watchlist?.name}&rdquo;?
                    </Text>
                    <Text style={[styles.alertBody, { color: colors.textSecondary }]}>
                        This watchlist and its stocks will be removed. Stocks in other watchlists are unaffected.
                    </Text>
                    <View style={styles.alertActions}>
                        <TouchableOpacity
                            style={[styles.alertBtn, { borderColor: colors.border }]}
                            onPress={onClose}
                        >
                            <Text style={[styles.alertBtnText, { color: colors.textPrimary }]}>
                                Cancel
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.alertBtn, styles.alertBtnDestructive, { backgroundColor: colors.negative }]}
                            onPress={onConfirm}
                        >
                            <Text style={[styles.alertBtnText, { color: "#fff" }]}>
                                Delete
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ─── IndicatorInfoModal ───────────────────────────────────────────────────────

const INDICATORS = [
    {
        label: "RSI",
        name: "Relative Strength Index",
        color: "#A78BFA",
        explanation:
            "Measures how overbought or oversold a stock is on a scale of 0–100. Calculated as 100 − (100 ÷ (1 + avg gain / avg loss)) over 14 days. Below 30 = oversold (green), above 70 = overbought (red). The arrow shows whether RSI is trending up or down.",
    },
    {
        label: "52W %",
        name: "52-Week Position",
        color: "#60A5FA",
        explanation:
            "Shows where the current price sits within its 52-week range. Formula: (price − 52W low) ÷ (52W high − 52W low) × 100. Near 0% means close to yearly low (green — potential buy zone), near 100% means close to yearly high (red — extended).",
    },
    {
        label: "V",
        name: "Relative Volume",
        color: "#34D399",
        explanation:
            "Compares today's trading volume to the stock's average daily volume. A value of 1.5x means 50% more volume than usual (green — high interest). Below 0.8x means unusually quiet trading (red). Shown as a multiplier (e.g. 2.1x).",
    },
    {
        label: "S▲ / R▼",
        name: "Support & Resistance Signal",
        color: "#F59E0B",
        explanation:
            "Detects if the stock is trading near a key support or resistance level based on historical price clusters. S▲ (green) means the price is near support — a level where buyers have previously stepped in. R▼ (red) means the price is near resistance — a level where selling pressure has historically appeared.",
    },
    {
        label: "M",
        name: "Momentum Score",
        color: "#F97316",
        explanation:
            "A composite score from 0–100 combining RSI, price vs moving averages, and volume trend. Above 70 = strong bullish momentum (green), 40–70 = neutral (yellow), below 40 = weak or bearish momentum (red).",
    },
    {
        label: "50 / 200",
        name: "Moving Average Trend",
        color: "#94A3B8",
        explanation:
            "Shows whether the stock is trading above (green) or below (red) its 50-day and 200-day simple moving averages. 50-day reflects medium-term trend; 200-day reflects long-term trend. Both green is a bullish sign; both red is bearish.",
    },
];

function IndicatorInfoModal({
    visible,
    onClose,
    colors,
    styles,
}: {
    visible: boolean;
    onClose: () => void;
    colors: ReturnType<typeof useTheme>["colors"];
    styles: ReturnType<typeof createStyles>;
}) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.modalOverlay} />
            </TouchableWithoutFeedback>
            <View
                style={[
                    styles.modalSheet,
                    { backgroundColor: colors.background, borderColor: colors.border },
                ]}
            >
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                        Indicator Guide
                    </Text>
                    <TouchableOpacity
                        onPress={onClose}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Close"
                    >
                        <Ionicons name="close" size={22} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>
                <ScrollView
                    contentContainerStyle={styles.modalContent}
                    showsVerticalScrollIndicator={false}
                >
                    {INDICATORS.map((ind) => (
                        <View
                            key={ind.label}
                            style={[
                                styles.indicatorCard,
                                { backgroundColor: colors.surface, borderColor: colors.border },
                            ]}
                        >
                            <View style={styles.indicatorCardHeader}>
                                <View
                                    style={[
                                        styles.indicatorBadge,
                                        { backgroundColor: ind.color + "22" },
                                    ]}
                                >
                                    <Text
                                        style={[styles.indicatorBadgeText, { color: ind.color }]}
                                    >
                                        {ind.label}
                                    </Text>
                                </View>
                                <Text
                                    style={[
                                        styles.indicatorName,
                                        { color: colors.textSecondary },
                                    ]}
                                >
                                    {ind.name}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.indicatorExplanation,
                                    { color: colors.textMuted },
                                ]}
                            >
                                {ind.explanation}
                            </Text>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </Modal>
    );
}

// ─── StockSearchInput ─────────────────────────────────────────────────────────

function StockSearchInput({
    watchedSymbols,
    onAdd,
    colors,
    styles,
}: {
    watchedSymbols: string[];
    onAdd: (symbol: string, company_name: string) => void;
    colors: ReturnType<typeof useTheme>["colors"];
    styles: ReturnType<typeof createStyles>;
}) {
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [open, setOpen] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!query.trim()) {
            setDebouncedQuery("");
            setOpen(false);
            return;
        }
        debounceRef.current = setTimeout(() => {
            setDebouncedQuery(query.trim());
            setOpen(true);
        }, 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    const { data: results = [], isFetching } = useQuery({
        queryKey: ["stockSearch", debouncedQuery],
        queryFn: () => watchlistsApi.search(debouncedQuery),
        enabled: debouncedQuery.length >= 1,
        staleTime: 30_000,
    });

    const handleSelect = (item: StockSearchResult) => {
        onAdd(item.symbol, item.description);
        setQuery("");
        setDebouncedQuery("");
        setOpen(false);
    };

    const showDropdown = open && debouncedQuery.length >= 1;

    return (
        <View style={styles.searchContainer}>
            <View style={styles.addRow} accessibilityRole="search">
                <Ionicons
                    name="search"
                    size={18}
                    color={colors.textMuted}
                    style={styles.searchIcon}
                    accessibilityElementsHidden
                />
                <TextInput
                    style={styles.input}
                    placeholder="Search symbol or company…"
                    placeholderTextColor={colors.textMuted}
                    value={query}
                    onChangeText={setQuery}
                    autoCapitalize="characters"
                    returnKeyType="search"
                    accessibilityLabel="Stock search input"
                    accessibilityHint="Type a symbol or company name to find and add stocks"
                />
                {isFetching && (
                    <ActivityIndicator
                        size="small"
                        color={colors.primary}
                        style={styles.searchSpinner}
                    />
                )}
                {query.length > 0 && !isFetching && (
                    <TouchableOpacity
                        onPress={() => {
                            setQuery("");
                            setDebouncedQuery("");
                            setOpen(false);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Clear search"
                    >
                        <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                )}
            </View>

            {showDropdown && (
                <View
                    style={[
                        styles.dropdown,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                >
                    {results.length === 0 && !isFetching ? (
                        <Text style={styles.dropdownEmpty}>
                            No results for &ldquo;{debouncedQuery}&rdquo;
                        </Text>
                    ) : (
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            style={{ maxHeight: 220 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {results.map((item, index) => {
                                const alreadyAdded = watchedSymbols.includes(item.symbol);
                                return (
                                    <TouchableOpacity
                                        key={`${item.symbol}-${index}`}
                                        style={[
                                            styles.dropdownRow,
                                            alreadyAdded && styles.dropdownRowDisabled,
                                        ]}
                                        onPress={() => !alreadyAdded && handleSelect(item)}
                                        disabled={alreadyAdded}
                                        accessibilityRole="button"
                                        accessibilityLabel={
                                            alreadyAdded
                                                ? `${item.symbol} already in watchlist`
                                                : `Add ${item.symbol} to watchlist`
                                        }
                                        accessibilityState={{ disabled: alreadyAdded }}
                                    >
                                        <View style={styles.dropdownInfo}>
                                            <Text style={styles.dropdownSymbol}>{item.symbol}</Text>
                                            <Text style={styles.dropdownName} numberOfLines={1}>
                                                {item.description}
                                            </Text>
                                        </View>
                                        {alreadyAdded ? (
                                            <Ionicons
                                                name="checkmark-circle"
                                                size={20}
                                                color={colors.positive}
                                            />
                                        ) : (
                                            <Ionicons
                                                name="add-circle-outline"
                                                size={20}
                                                color={colors.primary}
                                            />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>
            )}
        </View>
    );
}

// ─── WatchlistRow ─────────────────────────────────────────────────────────────

function calc52WeekPercent(price: number, low: number, high: number): number {
    if (high === low) return 0;
    return Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100));
}

function get52WeekColor(
    pct: number,
    positive: string,
    negative: string,
): string {
    if (pct <= 30) return positive;
    if (pct <= 70) return "#F59E0B";
    return negative;
}

function getMomentumScore(
    score: number,
    positive: string,
    negative: string,
): string {
    if (score >= 70) return positive;
    if (score >= 40) return "#F59E0B";
    return negative;
}

function getVolumeColor(
    relVol: number,
    positive: string,
    negative: string,
    muted: string,
): string {
    if (relVol > 1.5) return positive;
    if (relVol < 0.8) return negative;
    return muted;
}

function WatchlistRow({
    stock,
    livePrice,
    colors,
    styles,
}: {
    stock: WatchlistStock;
    livePrice?: LivePrice;
    colors: ReturnType<typeof useTheme>["colors"];
    styles: ReturnType<typeof createStyles>;
}) {
    const quote = stock.quote;

    // Overlay live price on top of REST snapshot
    const currentPrice = livePrice?.price ?? quote?.currentPrice ?? null;
    const changePercent = (() => {
        if (livePrice && quote?.previousClose && quote.previousClose > 0) {
            return ((livePrice.price - quote.previousClose) / quote.previousClose) * 100;
        }
        return quote?.changePercent ?? null;
    })();

    const isPositive = (changePercent ?? 0) >= 0;
    const changeColor = isPositive ? colors.positive : colors.negative;
    const rsiColor = stock.isOverbought
        ? colors.negative
        : stock.isOversold
            ? colors.positive
            : colors.textSecondary;

    const show52Week =
        currentPrice != null && stock.week52High != null && stock.week52Low != null;

    const pct52 = show52Week
        ? calc52WeekPercent(
            currentPrice!,
            stock.week52Low!,
            stock.week52High!,
        )
        : null;

    const sparkColor = isPositive ? colors.positive : colors.negative;

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/stock/${stock.symbol}`)}
            activeOpacity={0.75}
        >
            {/* Top row: logo + info | sparkline | price + star */}
            <View style={styles.cardTop}>
                {/* Left: logo + symbol + name */}
                <View style={styles.cardLeft}>
                    <View style={styles.logoWrap}>
                        {stock.quote?.profile?.logo ? (
                            <Image
                                source={{ uri: stock.quote.profile.logo }}
                                style={styles.logoImage}
                                contentFit="contain"
                                cachePolicy="memory-disk"
                            />
                        ) : (
                            <Text style={styles.logoText}>{stock.symbol.slice(0, 4)}</Text>
                        )}
                    </View>
                    <View style={styles.rowInfo}>
                        <Text style={styles.rowSymbol}>{stock.symbol}</Text>
                        <Text style={styles.rowName} numberOfLines={1}>
                            {stock.company_name ?? stock.symbol}
                        </Text>
                    </View>
                </View>

                {/* Center: sparkline */}
                <View style={styles.sparkWrap}>
                    {stock.sparkline && stock.sparkline.length >= 2 ? (
                        <LineChart
                            data={stock.sparkline}
                            width={80}
                            height={36}
                            color={sparkColor}
                            showGradient={false}
                        />
                    ) : (
                        <View style={{ width: 80, height: 36 }} />
                    )}
                </View>

                {/* Right: price + change + star */}
                <View style={styles.cardRight}>
                    <View style={styles.starPriceRow}>
                        <View style={styles.priceBlock}>
                            {currentPrice != null ? (
                                <Text style={styles.priceText}>
                                    ${currentPrice.toFixed(2)}
                                </Text>
                            ) : (
                                <Text style={styles.noData}>—</Text>
                            )}
                            {changePercent != null && (
                                <Text style={[styles.changeText, { color: changeColor }]}>
                                    {isPositive ? "+" : ""}
                                    {changePercent.toFixed(2)}%
                                </Text>
                            )}
                        </View>
                        <Ionicons
                            name="star-outline"
                            size={16}
                            color={colors.textMuted}
                            style={styles.starIcon}
                        />
                    </View>
                </View>
            </View>

            {/* Indicator row */}
            <View style={styles.indicatorRow}>
                {/* MA */}
                <View style={styles.indicatorCell}>
                    <Text style={styles.indicatorLabel}>MA</Text>
                    {stock.ma50Trend != null || stock.ma200Trend != null ? (
                        <View style={styles.indicatorValueInline}>
                            <Text
                                style={[
                                    styles.indicatorValue,
                                    {
                                        color:
                                            stock.ma50Trend === "green"
                                                ? colors.positive
                                                : stock.ma50Trend === "red"
                                                    ? colors.negative
                                                    : colors.textMuted,
                                    },
                                ]}
                            >
                                50
                            </Text>
                            <Text
                                style={[styles.indicatorValue, { color: colors.textMuted }]}
                            >
                                /
                            </Text>
                            <Text
                                style={[
                                    styles.indicatorValue,
                                    {
                                        color:
                                            stock.ma200Trend === "green"
                                                ? colors.positive
                                                : stock.ma200Trend === "red"
                                                    ? colors.negative
                                                    : colors.textMuted,
                                    },
                                ]}
                            >
                                200
                            </Text>
                        </View>
                    ) : (
                        <Text style={[styles.indicatorValue, { color: colors.textMuted }]}>
                            --
                        </Text>
                    )}
                </View>

                {/* RSI */}
                <View style={styles.indicatorCell}>
                    <View style={styles.indicatorLabelRow}>
                        <Text style={styles.indicatorLabel}>RSI</Text>
                        {stock.rsiTrend === "up" && (
                            <Ionicons name="arrow-up" size={9} color={colors.positive} />
                        )}
                        {stock.rsiTrend === "down" && (
                            <Ionicons name="arrow-down" size={9} color={colors.negative} />
                        )}
                    </View>
                    {stock.rsi != null ? (
                        <Text style={[styles.indicatorValue, { color: rsiColor }]}>
                            {stock.rsi.toFixed(1)}
                        </Text>
                    ) : (
                        <Text style={[styles.indicatorValue, { color: colors.textMuted }]}>
                            --
                        </Text>
                    )}
                </View>

                {/* 52W */}
                <View style={styles.indicatorCell}>
                    <Text style={styles.indicatorLabel}>52W</Text>
                    {pct52 != null ? (
                        <Text
                            style={[
                                styles.indicatorValue,
                                {
                                    color: get52WeekColor(
                                        pct52,
                                        colors.positive,
                                        colors.negative,
                                    ),
                                },
                            ]}
                        >
                            {pct52.toFixed(0)}%
                        </Text>
                    ) : (
                        <Text style={[styles.indicatorValue, { color: colors.textMuted }]}>
                            --
                        </Text>
                    )}
                </View>

                {/* M */}
                <View style={styles.indicatorCell}>
                    <Text style={styles.indicatorLabel}>M</Text>
                    {stock.momentumScore != null ? (
                        <Text
                            style={[
                                styles.indicatorValue,
                                {
                                    color: getMomentumScore(
                                        stock.momentumScore,
                                        colors.positive,
                                        colors.negative,
                                    ),
                                },
                            ]}
                        >
                            {stock.momentumScore}
                        </Text>
                    ) : (
                        <Text style={[styles.indicatorValue, { color: colors.textMuted }]}>
                            --
                        </Text>
                    )}
                </View>

                {/* V */}
                <View style={styles.indicatorCell}>
                    <Text style={styles.indicatorLabel}>V</Text>
                    {stock.relativeVolume != null ? (
                        <Text
                            style={[
                                styles.indicatorValue,
                                {
                                    color: getVolumeColor(
                                        stock.relativeVolume,
                                        colors.positive,
                                        colors.negative,
                                        colors.textMuted,
                                    ),
                                },
                            ]}
                        >
                            {stock.relativeVolume.toFixed(1)}x
                        </Text>
                    ) : (
                        <Text style={[styles.indicatorValue, { color: colors.textMuted }]}>
                            --
                        </Text>
                    )}
                </View>

                {/* S/R */}
                <View style={styles.indicatorCell}>
                    <Text style={styles.indicatorLabel}>{stock.srSignal != null ? "S/R" : " "}</Text>
                    {stock.srSignal != null ? (
                        <Text
                            style={[
                                styles.indicatorValue,
                                {
                                    color:
                                        stock.srSignal === "near_support"
                                            ? colors.positive
                                            : colors.negative,
                                },
                            ]}
                        >
                            {stock.srSignal === "near_support" ? "S▲" : "R▼"}
                        </Text>
                    ) : (
                        <Text style={styles.indicatorValue}> </Text>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
    return StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },

        // Header
        dropdownOverlay: {
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: 15,
        },
        pageHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: 4,
            zIndex: 20,
        },
        headerLeft: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        headerTitle: {
            fontSize: 22,
            fontWeight: "700",
            color: colors.textPrimary,
        },
        headerRight: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        searchIconBtn: {
            width: 36,
            height: 36,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: Radius.full,
            borderWidth: 1,
            borderColor: colors.border,
        },
        wlPickerContainer: {
            position: "relative",
            zIndex: 20,
        },
        wlPickerBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radius.full,
            paddingHorizontal: 12,
            paddingVertical: 7,
            maxWidth: 180,
        },
        wlPickerText: {
            fontSize: 14,
            fontWeight: "600",
            color: colors.textPrimary,
            maxWidth: 130,
        },
        wlDropdown: {
            position: "absolute",
            top: 44,
            right: 0,
            minWidth: 200,
            borderRadius: Radius.md,
            borderWidth: 1,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 8,
        },
        wlDropdownRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 13,
        },
        wlDropdownText: {
            fontSize: 14,
            fontWeight: "600",
        },
        wlDropdownDivider: {
            height: 1,
        },

        subtitleRow: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 2 },
        subtitle: { fontSize: 13, color: colors.textMuted },

        // Modals
        modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
        modalSheet: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderBottomWidth: 0,
            paddingBottom: 32,
            maxHeight: "78%",
        },
        modalHandle: {
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: "center",
            marginTop: 10,
            marginBottom: 4,
        },
        modalHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingVertical: 14,
        },
        modalTitle: { fontSize: 18, fontWeight: "700", flex: 1, marginRight: 12 },
        modalContent: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },

        // Input modals
        modalInputSection: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
        modalInput: {
            borderRadius: Radius.md,
            borderWidth: 1,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
        },
        modalPrimaryBtn: {
            borderRadius: Radius.full,
            paddingVertical: 13,
            alignItems: "center",
        },
        modalBtnDisabled: { opacity: 0.5 },
        modalPrimaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

        // Options modal
        optionsContent: { paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
        optionRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: Radius.md,
            borderWidth: 1,
        },
        optionText: { fontSize: 15, fontWeight: "600" },

        // Alert dialog (delete confirm)
        alertDialogWrap: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
        },
        alertDialog: {
            borderRadius: 16,
            borderWidth: 1,
            padding: 24,
            width: "100%",
            gap: 10,
        },
        alertTitle: { fontSize: 17, fontWeight: "700" },
        alertBody: { fontSize: 14, lineHeight: 20 },
        alertActions: { flexDirection: "row", gap: 10, marginTop: 6 },
        alertBtn: {
            flex: 1,
            borderRadius: Radius.full,
            paddingVertical: 11,
            alignItems: "center",
            borderWidth: 1,
        },
        alertBtnDestructive: { borderWidth: 0 },
        alertBtnText: { fontSize: 14, fontWeight: "700" },

        // Indicator info modal
        indicatorCard: {
            borderRadius: Radius.md,
            borderWidth: 1,
            padding: 14,
            gap: 8,
        },
        indicatorCardHeader: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
        },
        indicatorBadge: {
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 3,
        },
        indicatorBadgeText: { fontSize: 12, fontWeight: "700" },
        indicatorName: { fontSize: 13, fontWeight: "600" },
        indicatorExplanation: { fontSize: 13, lineHeight: 19 },

        // Search
        searchContainer: { paddingHorizontal: 20, paddingVertical: 8, zIndex: 10 },
        addRow: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: Radius.full,
            paddingHorizontal: 14,
            paddingVertical: 10,
            gap: 8,
        },
        searchIcon: { marginRight: 2 },
        searchSpinner: { marginLeft: 4 },
        input: {
            flex: 1,
            fontSize: 14,
            color: colors.textPrimary,
            paddingVertical: 2,
        },
        dropdown: {
            marginTop: 6,
            borderRadius: Radius.md,
            borderWidth: 1,
            overflow: "hidden",
        },
        dropdownEmpty: {
            padding: 16,
            fontSize: 13,
            color: colors.textMuted,
            textAlign: "center",
        },
        dropdownRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            gap: 12,
        },
        dropdownRowDisabled: { opacity: 0.5 },
        dropdownInfo: { flex: 1 },
        dropdownSymbol: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
        dropdownName: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },

        // Error
        errorCard: {
            marginHorizontal: 20,
            marginBottom: 8,
            backgroundColor: "#FEF2F2",
            borderRadius: Radius.md,
            padding: 12,
            flexDirection: "row",
            justifyContent: "space-between",
        },
        errorText: { color: colors.negative, fontSize: 13 },
        retryText: { color: colors.primary, fontWeight: "700", fontSize: 13 },

        // Empty state
        empty: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 40,
        },
        emptyTitle: {
            fontSize: 18,
            fontWeight: "700",
            color: colors.textPrimary,
            marginTop: 16,
            marginBottom: 8,
        },
        emptyText: {
            fontSize: 14,
            color: colors.textSecondary,
            textAlign: "center",
            lineHeight: 20,
        },

        // Stock list
        list: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: 4 },
        card: {
            backgroundColor: colors.surface,
            borderRadius: 14,
            padding: 14,
            marginBottom: 12,
        },
        cardTop: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
        },
        cardLeft: {
            flexDirection: "row",
            alignItems: "center",
            flex: 1,
            gap: 10,
            minWidth: 0,
        },
        sparkWrap: {
            alignItems: "center",
            justifyContent: "center",
            marginHorizontal: 8,
        },
        cardRight: { alignItems: "flex-end" },
        starPriceRow: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 6,
        },
        priceBlock: { alignItems: "flex-end" },
        starIcon: { marginTop: 2 },
        logoWrap: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
        },
        logoImage: { width: "100%", height: "100%", borderRadius: 22 },
        logoText: { fontSize: 11, fontWeight: "700", color: colors.textPrimary },
        rowInfo: { flex: 1, minWidth: 0 },
        rowSymbol: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
        rowName: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        priceText: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
        changeText: { fontSize: 12, fontWeight: "600", marginTop: 2 },
        noData: { fontSize: 12, color: colors.textMuted },

        // Indicator row (in card)
        indicatorRow: { flexDirection: "row", justifyContent: "space-between" },
        indicatorCell: { alignItems: "center", flex: 1 },
        indicatorLabelRow: { flexDirection: "row", alignItems: "center", gap: 2 },
        indicatorLabel: {
            fontSize: 10,
            color: colors.textMuted,
            fontWeight: "500",
            marginBottom: 2,
        },
        indicatorValue: { fontSize: 12, fontWeight: "700" },
        indicatorValueInline: { flexDirection: "row", alignItems: "center" },
    });
}
