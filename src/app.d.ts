// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface Platform {}
	}

	/** vite.config.ts 의 define 으로 빌드 타임에 주입된다. */
	const __APP_VERSION__: string;
	const __COMMIT_HASH__: string;
}

export {};
