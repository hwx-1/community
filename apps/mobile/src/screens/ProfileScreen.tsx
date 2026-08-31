import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  Bell,
  Bookmark,
  CalendarDays,
  ChevronRight,
  FileText,
  LogOut,
  Settings,
  ShieldCheck,
  UserRoundPen,
  type AliIconProps,
} from '../components/AliIcon';
import { Avatar } from '../components/Avatar';
import { PressableScale } from '../components/PressableScale';
import { PrimaryButton } from '../components/PrimaryButton';
import type { RootStackParamList } from '../navigation/types';
import { radius, spacing, useAppTheme } from '../theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type IconComponent = React.ComponentType<AliIconProps>;

export function ProfileScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<Navigation>();
  const { account, logout, refresh } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const posts = useQuery({
    queryKey: ['posts', 'mine'],
    queryFn: () => api.listPosts({ mine: true }),
  });
  const bookmarks = useQuery({
    queryKey: ['bookmarks'],
    queryFn: api.myBookmarks,
  });

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const profileCompletion = useMemo(() => {
    if (!account) return 0;
    const fields = [
      account.avatar,
      account.nickname,
      account.gender,
      account.class_name,
      account.real_name,
      account.student_no,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [account]);

  if (!account) return null;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refresh(), posts.refetch(), bookmarks.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('退出当前账号？', '退出后需要重新输入手机号和密码登录。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出登录',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const guideTitle = account.profile_done ? '完成学生认证' : '完善个人资料';
  const guideDescription = account.profile_done
    ? '认证后解锁发布、评论、私信和 AI 问答。'
    : '补齐班级和身份信息，建立可信的校园名片。';
  const guideAction = () =>
    navigation.navigate(account.profile_done ? 'Verification' : 'EditProfile');
  const createdAt = new Date(account.created_at);
  const joined = Number.isNaN(createdAt.getTime())
    ? '校园社区成员'
    : `${createdAt.getFullYear()} 年 ${createdAt.getMonth() + 1} 月加入`;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        <View style={styles.headingRow}>
          <View>
            <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>
              MY CAMPUS
            </Text>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              个人页
            </Text>
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="编辑个人资料"
            accessibilityHint="进入头像和基本资料编辑页面"
            onPress={() => navigation.navigate('EditProfile')}
            style={[
              styles.editButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            pressedStyle={{ backgroundColor: theme.colors.surfaceMuted }}
          >
            <UserRoundPen size={21} color={theme.colors.text} />
          </PressableScale>
        </View>

        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.identityRow}>
            <Avatar uri={account.avatar} name={account.nickname} size={76} />
            <View style={styles.profileMeta}>
              <View style={styles.nameLine}>
                <Text
                  style={[styles.name, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  {account.nickname}
                </Text>
                {account.verified ? (
                  <View
                    style={[
                      styles.verified,
                      { backgroundColor: theme.colors.primarySoft },
                    ]}
                  >
                    <ShieldCheck size={14} color={theme.colors.primary} />
                    <Text
                      style={[
                        styles.verifiedText,
                        { color: theme.colors.primary },
                      ]}
                    >
                      学生已认证
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[styles.info, { color: theme.colors.textSecondary }]}
                numberOfLines={1}
              >
                {account.class_name || '班级信息待完善'}
              </Text>
              <View style={styles.joinedRow}>
                <CalendarDays size={14} color={theme.colors.textSecondary} />
                <Text
                  style={[
                    styles.joinedText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {joined}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.stats, { borderTopColor: theme.colors.border }]}>
            <StatButton
              value={
                posts.isLoading ? '…' : String(posts.data?.items.length ?? 0)
              }
              label="我的帖子"
              onPress={() =>
                navigation.navigate('ContentList', {
                  mode: 'posts',
                  title: '我的帖子',
                })
              }
            />
            <View
              style={[
                styles.statDivider,
                { backgroundColor: theme.colors.border },
              ]}
            />
            <StatButton
              value={
                bookmarks.isLoading
                  ? '…'
                  : String(bookmarks.data?.items.length ?? 0)
              }
              label="我的收藏"
              onPress={() =>
                navigation.navigate('ContentList', {
                  mode: 'bookmarks',
                  title: '我的收藏',
                })
              }
            />
            <View
              style={[
                styles.statDivider,
                { backgroundColor: theme.colors.border },
              ]}
            />
            <StatButton
              value={`${profileCompletion}%`}
              label="资料完整度"
              onPress={() => navigation.navigate('EditProfile')}
            />
          </View>
        </View>

        {!account.verified ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${guideTitle}，${guideDescription}`}
            accessibilityHint="点按继续"
            onPress={guideAction}
            style={[
              styles.guideCard,
              { backgroundColor: theme.colors.primarySoft },
            ]}
            pressedStyle={styles.guidePressed}
          >
            <View
              style={[
                styles.guideIcon,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <ShieldCheck size={23} color={theme.colors.primary} />
            </View>
            <View style={styles.guideBody}>
              <Text style={[styles.guideTitle, { color: theme.colors.text }]}>
                {guideTitle}
              </Text>
              <Text
                style={[
                  styles.guideText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {guideDescription}
              </Text>
            </View>
            <ChevronRight size={18} color={theme.colors.primary} />
          </PressableScale>
        ) : null}

        <SectionLabel label="我的内容" />
        <View
          style={[
            styles.menu,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <MenuRow
            icon={FileText}
            label="我的帖子"
            description="查看公开、审核中和未通过内容"
            onPress={() =>
              navigation.navigate('ContentList', {
                mode: 'posts',
                title: '我的帖子',
              })
            }
          />
          <MenuRow
            icon={Bookmark}
            label="我的收藏"
            description="收藏内容仅自己可见"
            onPress={() =>
              navigation.navigate('ContentList', {
                mode: 'bookmarks',
                title: '我的收藏',
              })
            }
            last
          />
        </View>

        <SectionLabel label="账号与资料" />
        <View
          style={[
            styles.menu,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <MenuRow
            icon={UserRoundPen}
            label="编辑资料"
            description="头像、昵称、性别和班级"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <MenuRow
            icon={ShieldCheck}
            label="学生认证"
            description={
              account.verified
                ? '认证已通过，身份信息已保护'
                : '提交证明材料进行人工审核'
            }
            onPress={() => navigation.navigate('Verification')}
          />
          <MenuRow
            icon={Settings}
            label="账号设置"
            description="修改密码与账号注销"
            onPress={() => navigation.navigate('AccountSettings')}
            last
          />
        </View>

        <SectionLabel label="社区服务" />
        <View
          style={[
            styles.menu,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <MenuRow
            icon={Bell}
            label="平台公告"
            description="查看社区规则与服务通知"
            onPress={() => navigation.navigate('Announcements')}
            last
          />
        </View>

        <PrimaryButton
          label="退出登录"
          variant="secondary"
          loading={loggingOut}
          onPress={confirmLogout}
          style={styles.logout}
        />
        <View style={styles.operator}>
          <LogOut size={14} color={theme.colors.textSecondary} />
          <Text
            style={[styles.operatorText, { color: theme.colors.textSecondary }]}
          >
            本社区由学生独立运营，不代表学校官方。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ label }: { label: string }) {
  const theme = useAppTheme();
  return (
    <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
      {label}
    </Text>
  );
}

const StatButton = memo(function StatButtonComponent({
  value,
  label,
  onPress,
}: {
  value: string;
  label: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${label}，${value}`}
      onPress={onPress}
      style={styles.statButton}
      pressedStyle={{ backgroundColor: theme.colors.surfaceMuted }}
      pressedScale={0.97}
    >
      <Text style={[styles.statValue, { color: theme.colors.text }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
    </PressableScale>
  );
});

const MenuRow = memo(function MenuRowComponent({
  icon: Icon,
  label,
  description,
  onPress,
  last,
}: {
  icon: IconComponent;
  label: string;
  description: string;
  onPress: () => void;
  last?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${label}，${description}`}
      accessibilityHint="点按进入"
      onPress={onPress}
      style={[
        styles.menuRow,
        !last && {
          borderBottomColor: theme.colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
      pressedStyle={{ backgroundColor: theme.colors.surfaceMuted }}
      pressedScale={0.992}
    >
      <View
        style={[
          styles.menuIcon,
          { backgroundColor: theme.colors.surfaceMuted },
        ]}
      >
        <Icon size={20} color={theme.colors.text} />
      </View>
      <View style={styles.menuBody}>
        <Text style={[styles.menuLabel, { color: theme.colors.text }]}>
          {label}
        </Text>
        <Text
          style={[
            styles.menuDescription,
            { color: theme.colors.textSecondary },
          ]}
        >
          {description}
        </Text>
      </View>
      <ChevronRight size={18} color={theme.colors.textSecondary} />
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    paddingBottom: 120,
  },
  headingRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '900' },
  editButton: {
    width: 48,
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  identityRow: { padding: 18, flexDirection: 'row', alignItems: 'center' },
  profileMeta: { flex: 1, minWidth: 0, marginLeft: 16 },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: { maxWidth: '66%', fontSize: 22, lineHeight: 29, fontWeight: '900' },
  verified: {
    height: 26,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  verifiedText: { fontSize: 11, fontWeight: '800' },
  info: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  joinedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  joinedText: { fontSize: 12, lineHeight: 18 },
  stats: {
    minHeight: 82,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statButton: {
    flex: 1,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  statValue: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  statLabel: { fontSize: 11, lineHeight: 16, fontWeight: '600', marginTop: 3 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32 },
  guideCard: {
    minHeight: 88,
    borderRadius: radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  guidePressed: { opacity: 0.76 },
  guideIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideBody: { flex: 1, marginHorizontal: 12 },
  guideTitle: { fontSize: 15, lineHeight: 21, fontWeight: '800' },
  guideText: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  sectionLabel: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 9,
    marginLeft: 4,
  },
  menu: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  menuRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBody: { flex: 1, minWidth: 0, marginLeft: 12, marginRight: 8 },
  menuLabel: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  menuDescription: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  logout: { marginTop: 28 },
  operator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  operatorText: { fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
