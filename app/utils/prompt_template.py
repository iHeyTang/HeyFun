from jinja2 import Environment


class PromptTemplateManager:
    """Jinja2 Template Manager, for rendering prompt templates"""

    def __init__(self):
        self.env = Environment(
            trim_blocks=True, lstrip_blocks=True, keep_trailing_newline=True
        )

    def render_template(self, template_string: str, **kwargs) -> str:
        """Render Jinja2 template string"""
        template = self.env.from_string(template_string)
        return template.render(**kwargs)

    def render_template_safe(self, template_string: str, **kwargs) -> str:
        """Safe render Jinja2 template string, handle possible rendering errors"""
        try:
            return self.render_template(template_string, **kwargs)
        except Exception as e:
            # If Jinja2 rendering fails, fall back to Python's format method
            try:
                return template_string.format(**kwargs)
            except Exception:
                # If format also fails, return the original string
                return template_string


# Create a global template manager instance
template_manager = PromptTemplateManager()
