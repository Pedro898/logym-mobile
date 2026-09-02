import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

type Props = {
  size?: number;
};

export default function UserAvatarPlaceholder({ size = 130 }: Props) {
  const borderRadius = size / 2;
  const iconSize = size * 0.46;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        backgroundColor: '#f3f4f6',
        borderWidth: 2,
        borderColor: '#f97316',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Ionicons name="person-outline" size={iconSize} color="#000" />
    </View>
  );
}