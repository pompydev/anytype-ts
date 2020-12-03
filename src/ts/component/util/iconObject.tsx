import * as React from 'react';
import { Icon, Smile } from 'ts/component';
import { I, Util, DataUtil } from 'ts/lib';
import { commonStore } from 'ts/store';

interface Props {
	id?: string;
	layout?: I.ObjectLayout;
	object?: any;
	className?: string;
	iconClass?: string;
	canEdit?: boolean;
	native?: boolean;
	asImage?: boolean;
	size?: number;
	offsetX?: number;
	offsetY?: number;
	menuId?: string;
	onSelect?(id: string): void;
	onUpload?(hash: string): void;
};

class IconObject extends React.Component<Props, {}> {
	
	render () {
		let { layout, object, className } = this.props;
		let cn = [ 'icon', 'object' ];
		let type = DataUtil.schemaField(object.type);
		
		if (className) {
			cn.push(className);
		};

		let icon = null;
		switch (type) {
			default:
				icon = <Smile {...this.props} icon={object.iconEmoji} hash={object.iconImage} />;
				break;

			case 'image':
				icon = <img className="img" src={commonStore.imageUrl(object.id, 20)} />;
				break;

			case 'file':
				icon = <Icon className={[ 'file-type', Util.fileIcon(object) ].join(' ')} />;
				break;
		};
		
		return (
			<div className={cn.join(' ')}>
				{icon}
			</div>
		);
	};
	
};

export default IconObject;