// Dynamic app config for Expo. EAS requires the projectId be present under
// expo.extra.eas.projectId when using dynamic configuration.
// See: https://docs.expo.dev/eas/cli/eas-init/#configure-your-project

/**
 * If you already have other dynamic logic, merge the `extra.eas.projectId`
 * field into your existing exported config. The value below was taken from
 * the `eas init` output.
 */

const projectId = process.env.EAS_PROJECT_ID || "43ce3e62-a1c4-4d51-8af8-416c7a441fa3";

module.exports = ({ config }) => {
	return {
		...config,
		extra: {
			// preserve any existing extra values from app.json by shallow merging
			...(config.extra || {}),
			eas: {
				projectId,
			},
		},
	};
};
