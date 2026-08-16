const POSTHOG_KEY = "phc_DbsPb39SRc8z3EiQ6Dhj6ikv4H4rTKcht9d4sZSesceP";
const POSTHOG_OPTIONS = {
  api_host: "https://ap.emergent.sh",
  person_profiles: "identified_only",
  session_recording: {
    recordCrossOriginIframes: true,
    capturePerformance: false,
  },
};

export function enableAnalytics() {
  if (window.posthog?.__savvyInitialized) {
    window.posthog.opt_in_capturing?.();
    window.posthog.startSessionRecording?.();
    return;
  }

  const posthog = (window.posthog = window.posthog || []);
  if (!posthog.__SV) {
    posthog._i = [];
    posthog.init = function init(token, options, name) {
      const target = name ? (posthog[name] = []) : posthog;
      const methods = "capture identify setPersonProperties reset opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing startSessionRecording stopSessionRecording sessionRecordingStarted".split(" ");
      target.people = target.people || [];
      methods.forEach((method) => {
        target[method] = function queuedMethod() {
          target.push([method, ...Array.from(arguments)]);
        };
      });
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.crossOrigin = "anonymous";
      script.async = true;
      script.src = `${options.api_host.replace(".i.posthog.com", "-assets.i.posthog.com")}/static/array.js`;
      document.head.appendChild(script);
      posthog._i.push([token, options, name]);
    };
    posthog.__SV = 1;
  }
  posthog.init(POSTHOG_KEY, POSTHOG_OPTIONS);
  posthog.__savvyInitialized = true;
}

export function disableAnalytics() {
  window.posthog?.opt_out_capturing?.();
  window.posthog?.stopSessionRecording?.();
}
