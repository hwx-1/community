import React, { memo } from 'react';
import Svg, { G, Path } from 'react-native-svg';
import type {
  AbstractNode,
  IconDefinition,
} from '@ant-design/icons-svg/lib/types';
import BankOutlined from '@ant-design/icons-svg/lib/asn/BankOutlined';
import BellOutlined from '@ant-design/icons-svg/lib/asn/BellOutlined';
import BookOutlined from '@ant-design/icons-svg/lib/asn/BookOutlined';
import BulbOutlined from '@ant-design/icons-svg/lib/asn/BulbOutlined';
import CalendarOutlined from '@ant-design/icons-svg/lib/asn/CalendarOutlined';
import CameraOutlined from '@ant-design/icons-svg/lib/asn/CameraOutlined';
import CarOutlined from '@ant-design/icons-svg/lib/asn/CarOutlined';
import CheckCircleOutlined from '@ant-design/icons-svg/lib/asn/CheckCircleOutlined';
import CheckOutlined from '@ant-design/icons-svg/lib/asn/CheckOutlined';
import CloseOutlined from '@ant-design/icons-svg/lib/asn/CloseOutlined';
import DownOutlined from '@ant-design/icons-svg/lib/asn/DownOutlined';
import EditOutlined from '@ant-design/icons-svg/lib/asn/EditOutlined';
import EnvironmentOutlined from '@ant-design/icons-svg/lib/asn/EnvironmentOutlined';
import ExclamationCircleOutlined from '@ant-design/icons-svg/lib/asn/ExclamationCircleOutlined';
import ExportOutlined from '@ant-design/icons-svg/lib/asn/ExportOutlined';
import EyeInvisibleOutlined from '@ant-design/icons-svg/lib/asn/EyeInvisibleOutlined';
import EyeOutlined from '@ant-design/icons-svg/lib/asn/EyeOutlined';
import FileImageOutlined from '@ant-design/icons-svg/lib/asn/FileImageOutlined';
import FileTextOutlined from '@ant-design/icons-svg/lib/asn/FileTextOutlined';
import HeartFilled from '@ant-design/icons-svg/lib/asn/HeartFilled';
import HeartOutlined from '@ant-design/icons-svg/lib/asn/HeartOutlined';
import HomeOutlined from '@ant-design/icons-svg/lib/asn/HomeOutlined';
import InboxOutlined from '@ant-design/icons-svg/lib/asn/InboxOutlined';
import KeyOutlined from '@ant-design/icons-svg/lib/asn/KeyOutlined';
import LinkOutlined from '@ant-design/icons-svg/lib/asn/LinkOutlined';
import LockOutlined from '@ant-design/icons-svg/lib/asn/LockOutlined';
import LogoutOutlined from '@ant-design/icons-svg/lib/asn/LogoutOutlined';
import MessageOutlined from '@ant-design/icons-svg/lib/asn/MessageOutlined';
import NotificationOutlined from '@ant-design/icons-svg/lib/asn/NotificationOutlined';
import PhoneOutlined from '@ant-design/icons-svg/lib/asn/PhoneOutlined';
import PictureOutlined from '@ant-design/icons-svg/lib/asn/PictureOutlined';
import PlusOutlined from '@ant-design/icons-svg/lib/asn/PlusOutlined';
import PushpinFilled from '@ant-design/icons-svg/lib/asn/PushpinFilled';
import PushpinOutlined from '@ant-design/icons-svg/lib/asn/PushpinOutlined';
import ReadOutlined from '@ant-design/icons-svg/lib/asn/ReadOutlined';
import RightOutlined from '@ant-design/icons-svg/lib/asn/RightOutlined';
import RobotOutlined from '@ant-design/icons-svg/lib/asn/RobotOutlined';
import SafetyCertificateOutlined from '@ant-design/icons-svg/lib/asn/SafetyCertificateOutlined';
import SaveFilled from '@ant-design/icons-svg/lib/asn/SaveFilled';
import SaveOutlined from '@ant-design/icons-svg/lib/asn/SaveOutlined';
import SearchOutlined from '@ant-design/icons-svg/lib/asn/SearchOutlined';
import SendOutlined from '@ant-design/icons-svg/lib/asn/SendOutlined';
import SettingOutlined from '@ant-design/icons-svg/lib/asn/SettingOutlined';
import ShareAltOutlined from '@ant-design/icons-svg/lib/asn/ShareAltOutlined';
import ToolOutlined from '@ant-design/icons-svg/lib/asn/ToolOutlined';
import UpOutlined from '@ant-design/icons-svg/lib/asn/UpOutlined';
import UserOutlined from '@ant-design/icons-svg/lib/asn/UserOutlined';
import WarningOutlined from '@ant-design/icons-svg/lib/asn/WarningOutlined';

// 工作区同时包含 React 18 Web 与 React 19 Native，SVG 包的 children 类型会解析到
// React 18。运行时组件完全兼容，这里只在边界消除两套 ReactNode 声明的冲突。
const CompatibleSvg = Svg as unknown as React.ComponentType<
  Record<string, unknown>
>;
const CompatibleG =
  G as unknown as React.ComponentType<React.PropsWithChildren>;

export type AliIconProps = {
  size?: number;
  color?: string;
  fill?: string;
  strokeWidth?: number;
  accessibilityLabel?: string;
};

function renderNode(
  node: AbstractNode,
  color: string,
  key: string,
): React.ReactNode {
  if (node.tag === 'path') {
    return (
      <Path
        key={key}
        d={node.attrs.d}
        fill={
          node.attrs.fill && node.attrs.fill !== 'currentColor'
            ? node.attrs.fill
            : color
        }
        fillRule={node.attrs['fill-rule'] as 'evenodd' | 'nonzero' | undefined}
        clipRule={node.attrs['clip-rule'] as 'evenodd' | 'nonzero' | undefined}
        opacity={node.attrs.opacity ? Number(node.attrs.opacity) : undefined}
      />
    );
  }

  if (node.tag === 'g') {
    const children = node.children?.map((child, index) =>
      renderNode(child, color, `${key}-${index}`),
    );
    return <CompatibleG key={key}>{children}</CompatibleG>;
  }

  return (
    <React.Fragment key={key}>
      {node.children?.map((child, index) =>
        renderNode(child, color, `${key}-${index}`),
      )}
    </React.Fragment>
  );
}

function IconBase({
  definition,
  filledDefinition,
  size = 24,
  color = '#17181A',
  fill,
  accessibilityLabel,
}: AliIconProps & {
  definition: IconDefinition;
  filledDefinition?: IconDefinition;
}) {
  const active = Boolean(
    filledDefinition && fill && fill !== 'transparent' && fill !== 'none',
  );
  const selected = active && filledDefinition ? filledDefinition : definition;
  const icon =
    typeof selected.icon === 'function'
      ? selected.icon(color, color)
      : selected.icon;
  const children = icon.children?.map((child, index) =>
    renderNode(child, color, String(index)),
  );

  return (
    <CompatibleSvg
      width={size}
      height={size}
      viewBox={icon.attrs.viewBox ?? '64 64 896 896'}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
    >
      {children}
    </CompatibleSvg>
  );
}

function createIcon(
  definition: IconDefinition,
  filledDefinition?: IconDefinition,
) {
  return memo((props: AliIconProps) => (
    <IconBase
      definition={definition}
      filledDefinition={filledDefinition}
      {...props}
    />
  ));
}

// 统一使用 Ant Design Icons（阿里系）并保留业务语义命名，页面不直接依赖具体图标文件。
export const Bank = createIcon(BankOutlined);
export const Bell = createIcon(BellOutlined);
export const Book = createIcon(BookOutlined);
export const Bot = createIcon(RobotOutlined);
export const Bookmark = createIcon(SaveOutlined, SaveFilled);
export const Bulb = createIcon(BulbOutlined);
export const BusFront = createIcon(CarOutlined);
export const CalendarDays = createIcon(CalendarOutlined);
export const Camera = createIcon(CameraOutlined);
export const Check = createIcon(CheckOutlined);
export const CheckBadge = createIcon(CheckCircleOutlined);
export const ChevronDown = createIcon(DownOutlined);
export const ChevronRight = createIcon(RightOutlined);
export const ChevronUp = createIcon(UpOutlined);
export const CircleAlert = createIcon(ExclamationCircleOutlined);
export const Close = createIcon(CloseOutlined);
export const Edit = createIcon(EditOutlined);
export const ExternalLink = createIcon(ExportOutlined);
export const Eye = createIcon(EyeOutlined);
export const EyeOff = createIcon(EyeInvisibleOutlined);
export const FileImage = createIcon(FileImageOutlined);
export const FileText = createIcon(FileTextOutlined);
export const GraduationCap = createIcon(ReadOutlined);
export const Heart = createIcon(HeartOutlined, HeartFilled);
export const Home = createIcon(HomeOutlined);
export const ImagePlus = createIcon(PictureOutlined);
export const Inbox = createIcon(InboxOutlined);
export const KeyRound = createIcon(KeyOutlined);
export const Library = createIcon(BookOutlined);
export const Link2 = createIcon(LinkOutlined);
export const LockKeyhole = createIcon(LockOutlined);
export const LogOut = createIcon(LogoutOutlined);
export const Map = createIcon(EnvironmentOutlined);
export const Megaphone = createIcon(NotificationOutlined);
export const MessageCircle = createIcon(MessageOutlined);
export const Phone = createIcon(PhoneOutlined);
export const PhoneCall = createIcon(PhoneOutlined);
export const Pin = createIcon(PushpinOutlined, PushpinFilled);
export const Plus = createIcon(PlusOutlined);
export const Search = createIcon(SearchOutlined);
export const Send = createIcon(SendOutlined);
export const Settings = createIcon(SettingOutlined);
export const Share2 = createIcon(ShareAltOutlined);
export const ShieldCheck = createIcon(SafetyCertificateOutlined);
export const Sparkles = createIcon(BulbOutlined);
export const UserRound = createIcon(UserOutlined);
export const UserRoundPen = createIcon(EditOutlined);
export const Warning = createIcon(WarningOutlined);
export const Wrench = createIcon(ToolOutlined);
export const X = createIcon(CloseOutlined);
