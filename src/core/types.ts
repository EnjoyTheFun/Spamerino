export type CopyPasta = {
	id: number;
	content: string;
	tags: string[];
	channels: string[];
};

export type ImpulseListener<T> = (value: T) => any;
export type ImpulseOptions = { pulseOnDuplicate?: boolean };
