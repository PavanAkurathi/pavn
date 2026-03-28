import type { ReactNode } from "react";
import { Pressable } from "react-native";

import { ListGroup } from "heroui-native/list-group";
import { Separator } from "heroui-native/separator";

import { Icon } from "./icon";

type MenuItemProps = {
    icon: string;
    title: string;
    description?: string;
    onPress?: () => void;
    suffix?: ReactNode;
};

type MenuListProps = {
    items: MenuItemProps[];
};

export function MenuList({ items }: MenuListProps) {
    return (
        <ListGroup>
            {items.map((item, index) => (
                <Pressable key={`${item.title}-${index}`} onPress={item.onPress}>
                    <ListGroup.Item>
                        <ListGroup.ItemPrefix>
                            <Icon name={item.icon as any} size={18} className="text-muted" />
                        </ListGroup.ItemPrefix>
                        <ListGroup.ItemContent>
                            <ListGroup.ItemTitle>{item.title}</ListGroup.ItemTitle>
                            {item.description ? (
                                <ListGroup.ItemDescription>{item.description}</ListGroup.ItemDescription>
                            ) : null}
                        </ListGroup.ItemContent>
                        {item.suffix ? (
                            <ListGroup.ItemSuffix>{item.suffix}</ListGroup.ItemSuffix>
                        ) : (
                            <ListGroup.ItemSuffix />
                        )}
                    </ListGroup.Item>
                    {index < items.length - 1 ? <Separator className="mx-4" /> : null}
                </Pressable>
            ))}
        </ListGroup>
    );
}
