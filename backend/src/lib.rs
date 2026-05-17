use hf_plugin_api::{
    declare_plugin, HaloForgePlugin, IpcRegistrar, LogLevel, PluginContext, PluginError,
    PluginMetadata, PLUGIN_ABI_VERSION,
};

mod commands;

pub struct ImageStudioPlugin;

impl ImageStudioPlugin {
    pub fn new() -> Self {
        Self
    }
}

impl Default for ImageStudioPlugin {
    fn default() -> Self {
        Self::new()
    }
}

impl HaloForgePlugin for ImageStudioPlugin {
    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            id: "dev.haloforge.image-studio".into(),
            name: "Image Studio".into(),
            version: "0.1.5".into(),
            description: "Professional OpenAI-compatible image generation workspace for HaloForge."
                .into(),
            author: "HaloForge Team".into(),
            abi_version: PLUGIN_ABI_VERSION,
        }
    }

    fn on_load(
        &mut self,
        ctx: &dyn PluginContext,
        ipc: &mut dyn IpcRegistrar,
    ) -> Result<(), PluginError> {
        ipc.register(
            "image_studio_generate_images",
            Box::new(commands::image_studio_generate_images),
        )?;
        ipc.register(
            "image_studio_edit_images",
            Box::new(commands::image_studio_edit_images),
        )?;

        ctx.log(LogLevel::Info, "Image Studio plugin loaded");
        Ok(())
    }

    fn on_unload(&mut self) -> Result<(), PluginError> {
        Ok(())
    }
}

declare_plugin!(ImageStudioPlugin, ImageStudioPlugin::new);
